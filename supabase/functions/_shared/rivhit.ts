import type { Db } from './db.ts';
import type { Order, OrderItem } from './types.ts';
import { addIsraeliBusinessDays, fromIsraeliWallClock } from './businessDays.ts';
import { newId } from './ids.ts';

/**
 * Read-only connection to Rivhit Online.
 * Docs: https://api.rivhit.co.il/online/RivhitOnlineAPI.svc/help
 * We only call Document.List, Document.Details and Document.TypeList — nothing is ever written to Rivhit.
 *
 * Rivhit knows only open / closed / cancelled; the packing progress lives in our app:
 *   open in Rivhit                 → imported as "new"
 *   closed (delivery note/invoice) → if still in our pipeline, marked "shipped"
 *   cancelled                      → if still in our pipeline, marked cancelled + manager alert
 */

export const RIVHIT_BASE_URL = 'https://api.rivhit.co.il/online/RivhitOnlineAPI.svc';

export interface RivhitDocSummary {
  document_type: number;
  document_number: number;
  document_date?: string;
  document_time?: string;
  customer_name?: string;
  customer_firstname?: string;
  customer_lastname?: string;
  is_cancelled?: boolean;
  /** Closed in Rivhit — a delivery note / invoice was produced from this order. */
  is_closed?: boolean;
  comments?: string;
}

export interface RivhitDocType {
  document_type: number;
  document_name: string;
}

export interface RivhitDocLine {
  line?: number;
  description?: string;
  catalog_number?: string;
  quantity?: number;
}

export interface RivhitDocDetails extends Omit<RivhitDocSummary, 'document_number' | 'document_type'> {
  document_type?: number | string;
  document_number?: number | string;
  /** Rivhit's own spelling in Document.Details. */
  documnet_time?: string;
  items?: RivhitDocLine[];
}

export interface RivhitClient {
  listDocuments(documentType: number, fromDate: Date): Promise<RivhitDocSummary[]>;
  documentDetails(documentType: number, documentNumber: number): Promise<RivhitDocDetails>;
  listDocumentTypes(): Promise<RivhitDocType[]>;
}

export class RivhitError extends Error {}

/** dd/MM/yyyy on the Israeli calendar — the format Rivhit shows in its UI. */
export function formatRivhitDate(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year}`;
}

export function createRivhitClient(apiToken: string, fetchImpl: typeof fetch = fetch, baseUrl = RIVHIT_BASE_URL): RivhitClient {
  const call = async <T>(method: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetchImpl(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_token: apiToken, ...body }),
    });
    if (!res.ok) throw new RivhitError(`Rivhit ${method}: HTTP ${res.status}`);
    const json = await res.json() as { error_code?: number; client_message?: string; debug_message?: string; data?: T };
    if (json.error_code) {
      throw new RivhitError(`Rivhit ${method}: ${json.client_message || json.debug_message || `error ${json.error_code}`}`);
    }
    return json.data as T;
  };

  return {
    async listDocuments(documentType, fromDate) {
      const data = await call<{ document_list?: RivhitDocSummary[] }>('Document.List', {
        from_document_type: documentType,
        to_document_type: documentType,
        from_date: formatRivhitDate(fromDate),
      });
      return data?.document_list ?? [];
    },
    documentDetails(documentType, documentNumber) {
      return call<RivhitDocDetails>('Document.Details', {
        document_type: documentType,
        document_number: documentNumber,
      });
    },
    async listDocumentTypes() {
      const data = await call<{ document_type_list?: RivhitDocType[] }>('Document.TypeList', {});
      return data?.document_type_list ?? [];
    },
  };
}

/**
 * Parses Rivhit date/time strings into a real instant (Rivhit times are Israeli wall-clock).
 * Accepts dd/MM/yyyy, yyyy-MM-dd(THH:mm…), and WCF "/Date(ms)/".
 */
export function parseRivhitDateTime(date?: string, time?: string): Date | undefined {
  if (!date) return undefined;
  const wcf = /\/Date\((-?\d+)/.exec(date);
  if (wcf) return new Date(Number(wcf[1]));

  let y: number, m: number, d: number;
  let hh = 0, mm = 0;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(date);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(date);
  if (dmy) [d, m, y] = [+dmy[1], +dmy[2], +dmy[3]];
  else if (ymd) {
    [y, m, d] = [+ymd[1], +ymd[2], +ymd[3]];
    if (ymd[4]) [hh, mm] = [+ymd[4], +ymd[5]];
  } else return undefined;

  const t = time && /(\d{1,2}):(\d{2})/.exec(time);
  if (t) [hh, mm] = [+t[1], +t[2]];
  return fromIsraeliWallClock(y, m, d, hh, mm);
}

/** Not yet shipped or cancelled — Rivhit changes still apply. */
const inPipeline = (o: Order) => o.status === 'new' || o.status === 'in_progress' || o.status === 'ready_to_ship';

function customerName(doc: RivhitDocSummary | RivhitDocDetails): string {
  const full = [doc.customer_firstname, doc.customer_lastname].filter(Boolean).join(' ');
  return doc.customer_name?.trim() || full.trim() || 'לקוח ללא שם';
}

export interface SyncOptions {
  documentType: number;
  /** How far back to look for new open orders (status changes are tracked for older imported ones too). */
  lookbackDays?: number;
  /** Cap on Document.Details calls per run, so one run never times out. */
  maxNewPerRun?: number;
  businessDaysToDeliver?: number;
  now?: () => Date;
}

export interface SyncResult {
  imported: number;
  cancelled: number;
  /** Closed in Rivhit while still in our pipeline → marked shipped. */
  closed: number;
  skipped: number;
  /** New documents left for the next run because of maxNewPerRun. */
  remaining: number;
}

const time = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/** Runs `run` unless the previous sync (successful or not) was less than `minIntervalMs` ago. */
export async function runSyncIfDue<T>(
  db: Db,
  run: () => Promise<T>,
  minIntervalMs = 45_000,
  now: () => Date = () => new Date(),
): Promise<T | { skipped: true }> {
  const s = await db.getSyncStatus();
  const last = Math.max(time(s.lastSuccessAt), time(s.lastErrorAt));
  if (now().getTime() - last < minIntervalMs) return { skipped: true };
  return run();
}

/** Pulls new orders from Rivhit into our Db. Safe to run often and concurrently. */
export async function syncFromRivhit(db: Db, client: RivhitClient, opts: SyncOptions): Promise<SyncResult> {
  const now = opts.now ?? (() => new Date());
  const lookback = opts.lookbackDays ?? 7;
  const maxNew = opts.maxNewPerRun ?? 25;
  const days = opts.businessDaysToDeliver ?? 3;
  const result: SyncResult = { imported: 0, cancelled: 0, closed: 0, skipped: 0, remaining: 0 };
  const prev = await db.getSyncStatus();

  try {
    // New orders: the last `lookback` days. But orders we imported earlier and are still packing
    // must keep being checked for close/cancel, so reach back to the oldest of those (max 60 days).
    const newSince = now().getTime() - lookback * 86_400_000;
    const snap = await db.snapshot(new Date(newSince));
    const oldestOpen = Math.min(
      ...snap.orders.filter((o) => o.source === 'rivahit' && inPipeline(o)).map((o) => new Date(o.createdAt).getTime()),
    );
    const from = new Date(Math.max(Math.min(newSince, oldestOpen), now().getTime() - 60 * 86_400_000));
    const docs = await client.listDocuments(opts.documentType, from);
    // Oldest first, so if we hit the cap the oldest orders get in first.
    docs.sort((a, b) => a.document_number - b.document_number);

    let budget = maxNew;
    for (const doc of docs) {
      const externalId = String(doc.document_number);
      const existing = await db.findOrderByExternalId(externalId);

      if (existing) {
        if (!inPipeline(existing)) continue;
        const at = now().toISOString();
        // Cancelled in Rivhit after we imported it — stop the packers and tell the manager.
        if (doc.is_cancelled) {
          await db.updateOrder(existing.id, { status: 'cancelled', updatedAt: at });
          await db.insertAlert({
            id: newId('al'), orderId: existing.id, type: 'issue_report',
            message: `ההזמנה בוטלה בריווחית (מס׳ ${externalId}) – לא לארוז`,
            createdAt: at, createdBy: 'manager', acknowledged: false,
          });
          result.cancelled++;
        } else if (doc.is_closed) {
          // A delivery note / invoice was issued in Rivhit: the order has gone out.
          await db.updateOrder(existing.id, {
            status: 'shipped',
            completedAt: existing.completedAt ?? at,
            updatedAt: at,
          });
          await db.insertLog({ id: newId('log'), orderId: existing.id, action: 'shipped', role: 'manager', details: 'נסגרה בריווחית', at });
          result.closed++;
        }
        continue;
      }
      if (doc.is_cancelled || doc.is_closed || (parseRivhitDateTime(doc.document_date, doc.document_time) ?? now()).getTime() < newSince - 86_400_000) {
        result.skipped++;
        continue;
      }
      if (budget <= 0) {
        result.remaining++;
        continue;
      }
      budget--;

      const details = await client.documentDetails(opts.documentType, doc.document_number);
      const created = parseRivhitDateTime(doc.document_date ?? details.document_date, doc.document_time ?? details.documnet_time) ?? now();
      const order: Order = {
        id: newId('ord'),
        externalId,
        source: 'rivahit',
        clientName: customerName(details.customer_name ? details : doc),
        createdAt: created.toISOString(),
        deliveryDeadline: addIsraeliBusinessDays(created, days).toISOString(),
        businessDaysToDeliver: days,
        status: 'new',
        notes: (details.comments ?? doc.comments)?.trim() || undefined,
        updatedAt: now().toISOString(),
      };
      const items: OrderItem[] = (details.items ?? [])
        .filter((l) => l.description?.trim() && (l.quantity ?? 0) > 0)
        .sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
        .map((l) => ({
          id: newId('itm'),
          orderId: order.id,
          sku: l.catalog_number?.trim() || undefined,
          name: l.description!.trim(),
          quantityOrdered: Number(l.quantity),
          state: 'pending',
          updatedAt: order.updatedAt,
        }));

      try {
        await db.insertOrder(order, items);
      } catch {
        // Another sync run imported it a moment ago (unique externalId) — fine.
        result.skipped++;
        continue;
      }
      result.imported++;
      await db.insertLog({ id: newId('log'), orderId: order.id, action: 'created', role: 'manager', details: `יובא מריווחית (מס׳ ${externalId})`, at: order.updatedAt });

      if (items.length === 0) {
        await db.insertAlert({
          id: newId('al'), orderId: order.id, type: 'issue_report',
          message: `הזמנה מס׳ ${externalId} הגיעה מריווחית בלי פריטים – יש לבדוק`,
          createdAt: order.updatedAt, createdBy: 'manager', acknowledged: false,
        });
      }
    }

    await db.setSyncStatus({ lastSuccessAt: now().toISOString(), lastError: null, lastErrorAt: null }, !!prev.lastError);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.setSyncStatus({ lastError: message, lastErrorAt: now().toISOString() }, !prev.lastError);
    throw e;
  }
}


/**
 * Read-only look at what Rivhit returns for one document type — used once, before switching the
 * import on, to check the date format, the open/closed flags and the item lines.
 */
export async function previewRivhit(client: RivhitClient, documentType: number, now: () => Date = () => new Date()) {
  const docs = await client.listDocuments(documentType, new Date(now().getTime() - 14 * 86_400_000));
  const newest = [...docs].sort((a, b) => b.document_number - a.document_number);
  const firstOpen = newest.find((d) => !d.is_closed && !d.is_cancelled);
  const details = firstOpen ? await client.documentDetails(documentType, firstOpen.document_number) : undefined;
  return {
    documentType,
    last14Days: {
      total: docs.length,
      open: docs.filter((d) => !d.is_closed && !d.is_cancelled).length,
      closed: docs.filter((d) => d.is_closed).length,
      cancelled: docs.filter((d) => d.is_cancelled).length,
    },
    newest: newest.slice(0, 5).map((d) => ({
      number: d.document_number,
      date: d.document_date,
      time: d.document_time,
      parsed: parseRivhitDateTime(d.document_date, d.document_time)?.toISOString() ?? null,
      customer: customerName(d),
      is_closed: d.is_closed ?? null,
      is_cancelled: d.is_cancelled ?? null,
    })),
    firstOpenItems: details?.items?.slice(0, 10).map((l) => ({ line: l.line, sku: l.catalog_number, name: l.description, qty: l.quantity })) ?? null,
  };
}
