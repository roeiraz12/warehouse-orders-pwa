import { NotFoundError, RuleError, type OrderService } from './service.ts';
import type { ItemState, Role } from './types.ts';

/**
 * The cloud API. Runtime-agnostic (Web Request/Response), so the same code runs in
 * the Supabase Edge Function and in the local dev server (server/dev.ts).
 *
 *   GET  /api/version                 → { version }
 *   GET  /api/snapshot                → Snapshot
 *   POST /api/orders                  { input, by }                → Order
 *   POST /api/items/:id/state         { state, quantityMissing, by } → OrderItem
 *   POST /api/orders/:id/touch        { by }
 *   POST /api/orders/:id/issues       { message, by }              → Alert
 *   POST /api/orders/:id/complete     { by }                       → Order
 *   POST /api/orders/:id/ship         { by }                       → Order
 *   POST /api/alerts/:id/ack
 *   GET  /api/rivhit/types            → Rivhit document types (read-only check)
 *   GET  /api/rivhit/preview?type=N   → what Rivhit returns for type N (read-only check)
 *   POST /api/sync                    → SyncResult (no code needed — see below)
 *
 * Every call needs the shared business code in the `x-business-code` header, except /sync:
 * the scheduled job calls it without secrets. It only *pulls* from Rivhit, is rate-limited by
 * the caller (runSyncIfDue), and anonymous callers get back nothing but { ok: true }.
 */

export interface HandlerOptions {
  service: OrderService;
  businessCode: string;
  sync?: () => Promise<unknown>;
  /** Read-only Rivhit checks — available once the API token is set, even before the import is on. */
  rivhit?: { types: () => Promise<unknown>; preview: (documentType: number) => Promise<unknown> };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-business-code, authorization, apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body ?? null), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ROLES: Role[] = ['manager', 'employee'];
const STATES: ItemState[] = ['pending', 'packed', 'missing'];
const asRole = (v: unknown): Role => (ROLES.includes(v as Role) ? (v as Role) : 'employee');

export function createHandler({ service, businessCode, sync, rivhit }: HandlerOptions) {
  if (!businessCode) throw new Error('BUSINESS_CODE is not configured');

  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // Works whether mounted at /api/... (dev) or /functions/v1/api/... (Supabase).
    const path = new URL(req.url).pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/';
    const seg = path.split('/').filter(Boolean);

    const authed = safeEqual(req.headers.get('x-business-code') ?? '', businessCode);
    const isSync = req.method === 'POST' && path === '/sync';
    if (!authed && !isSync) return json({ error: 'unauthorized' }, 401);

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        body = (await req.json()) ?? {};
      } catch {
        body = {};
      }
    }
    const by = asRole(body.by);

    try {
      if (req.method === 'GET' && path === '/version') return json({ version: await service.version() });
      if (req.method === 'GET' && seg[0] === 'rivhit') {
        if (!rivhit) return json({ error: 'RIVHIT_API_TOKEN is not set' }, 503);
        if (path === '/rivhit/types') return json(await rivhit.types());
        if (path === '/rivhit/preview') {
          const type = Number(new URL(req.url).searchParams.get('type'));
          if (!type) return json({ error: 'type is required' }, 400);
          return json(await rivhit.preview(type));
        }
      }
      if (req.method === 'GET' && path === '/snapshot') {
        const snap = await service.loadAll();
        return json({ ...snap, sync: { ...snap.sync, enabled: !!sync } });
      }

      if (req.method === 'POST') {
        if (path === '/orders') return json(await service.createOrder(body.input as never, by), 201);
        if (path === '/sync') {
          if (!sync) return json({ error: 'Rivhit sync is not configured' }, 503);
          const result = await sync();
          return json(authed ? result : { ok: true });
        }
        if (seg[0] === 'items' && seg[2] === 'state' && seg.length === 3) {
          const state = body.state as ItemState;
          if (!STATES.includes(state)) return json({ error: 'bad state' }, 400);
          const qty = typeof body.quantityMissing === 'number' ? body.quantityMissing : undefined;
          return json(await service.setItemState(seg[1], state, by, qty));
        }
        if (seg[0] === 'orders' && seg.length === 3) {
          const id = seg[1];
          if (seg[2] === 'touch') return json(await service.touchOrder(id, by));
          if (seg[2] === 'issues') return json(await service.reportIssue(id, String(body.message ?? ''), by), 201);
          if (seg[2] === 'complete') return json(await service.completeOrder(id, by));
          if (seg[2] === 'ship') return json(await service.markShipped(id, by));
        }
        if (seg[0] === 'alerts' && seg[2] === 'ack' && seg.length === 3) {
          return json(await service.acknowledgeAlert(seg[1]));
        }
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      if (e instanceof NotFoundError) return json({ error: e.message }, 404);
      if (e instanceof RuleError) return json({ error: e.message }, 409);
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'server error' }, 500);
    }
  };
}
