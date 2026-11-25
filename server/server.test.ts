import { describe, expect, it } from 'vitest';
import { MemoryDb } from '../supabase/functions/_shared/memoryDb.ts';
import { createOrderService } from '../supabase/functions/_shared/service.ts';
import { createHandler } from '../supabase/functions/_shared/handler.ts';
import {
  createRivhitClient,
  parseRivhitDateTime,
  runSyncIfDue,
  previewRivhit,
  syncFromRivhit,
  type RivhitClient,
  type RivhitDocLine,
  type RivhitDocDetails,
  type RivhitDocSummary,
} from '../supabase/functions/_shared/rivhit.ts';

const DOC_TYPE = 7;

function fakeClient(docs: (RivhitDocSummary & { items?: RivhitDocDetails['items'] })[]): RivhitClient & { detailsCalls: number } {
  const c = {
    detailsCalls: 0,
    async listDocuments() {
      return docs.map(({ items: _i, ...d }) => d);
    },
    async listDocumentTypes() {
      return [];
    },
    async documentDetails(_t: number, n: number) {
      c.detailsCalls++;
      const d = docs.find((x) => x.document_number === n)!;
      return { ...d };
    },
  };
  return c;
}

const doc = (n: number, extra: Partial<RivhitDocSummary> = {}, items: RivhitDocLine[] = [{ line: 1, description: 'במבה', catalog_number: 'B1', quantity: 10 }]) => ({
  document_type: DOC_TYPE,
  document_number: n,
  document_date: '08/10/2026',
  document_time: '14:30',
  customer_name: `לקוח ${n}`,
  is_cancelled: false,
  items,
  ...extra,
});

describe('parseRivhitDateTime', () => {
  it('reads Israeli wall-clock dd/MM/yyyy + HH:mm (summer time, UTC+3)', () => {
    expect(parseRivhitDateTime('08/10/2026', '14:30')?.toISOString()).toBe('2026-10-08T11:30:00.000Z');
  });
  it('handles winter time (UTC+2)', () => {
    expect(parseRivhitDateTime('15/12/2026', '09:00')?.toISOString()).toBe('2026-12-15T07:00:00.000Z');
  });
  it('reads ISO and WCF dates', () => {
    expect(parseRivhitDateTime('2026-10-08T14:30:00')?.toISOString()).toBe('2026-10-08T11:30:00.000Z');
    expect(parseRivhitDateTime('/Date(1791460000000+0300)/')?.getTime()).toBe(1791460000000);
  });
  it('returns undefined for garbage', () => {
    expect(parseRivhitDateTime('soon')).toBeUndefined();
    expect(parseRivhitDateTime(undefined)).toBeUndefined();
  });
});

describe('syncFromRivhit', () => {
  const now = () => new Date('2026-10-08T12:00:00Z');

  it('imports new orders with their items, once', async () => {
    const db = new MemoryDb();
    const client = fakeClient([doc(101), doc(102, {}, [
      { line: 2, description: 'ביסלי', quantity: 3 },
      { line: 1, description: 'קפה', catalog_number: 'K1', quantity: 2 },
      { line: 3, description: 'שורת הערה', quantity: 0 },
    ])]);

    const r1 = await syncFromRivhit(db, client, { documentType: DOC_TYPE, now });
    expect(r1.imported).toBe(2);
    const r2 = await syncFromRivhit(db, client, { documentType: DOC_TYPE, now });
    expect(r2.imported).toBe(0);
    expect(client.detailsCalls).toBe(2); // no re-fetch of known orders

    const o = (await db.findOrderByExternalId('102'))!;
    expect(o.clientName).toBe('לקוח 102');
    expect(o.source).toBe('rivahit');
    expect(o.createdAt).toBe('2026-10-08T11:30:00.000Z');
    // Thursday + 3 business days = Tuesday
    expect(new Date(o.deliveryDeadline).getUTCDate()).toBe(13);
    const items = await db.listItems(o.id);
    expect(items.map((i) => i.name)).toEqual(['קפה', 'ביסלי']); // Rivhit line order, zero-qty lines dropped
    expect(items[0]).toMatchObject({ sku: 'K1', quantityOrdered: 2, state: 'pending' });
    expect((await db.getSyncStatus()).lastSuccessAt).toBe(now().toISOString());
  });

  it('marks an active order cancelled when Rivhit cancels it, and alerts the manager', async () => {
    const db = new MemoryDb();
    const docs = [doc(201)];
    await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now });
    docs[0].is_cancelled = true;
    const r = await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now });
    expect(r.cancelled).toBe(1);
    const o = (await db.findOrderByExternalId('201'))!;
    expect(o.status).toBe('cancelled');
    expect(db.state.alerts.some((a) => a.orderId === o.id && a.message.includes('בוטלה'))).toBe(true);
  });

  it('marks an order shipped when Rivhit closes it (delivery note / invoice), even mid-packing', async () => {
    const db = new MemoryDb();
    const docs = [doc(501), doc(502)];
    await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now });
    const service = createOrderService(db, now);
    const o502 = (await db.findOrderByExternalId('502'))!;
    const [line] = await db.listItems(o502.id);
    await service.setItemState(line.id, 'packed', 'employee'); // being packed

    docs[0].is_closed = true;
    docs[1].is_closed = true;
    const r = await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now });
    expect(r.closed).toBe(2);
    expect((await db.findOrderByExternalId('501'))!.status).toBe('shipped');
    expect((await db.findOrderByExternalId('502'))!.status).toBe('shipped');
    // Running again changes nothing.
    expect((await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now })).closed).toBe(0);
  });

  it('does not import orders that are already closed, or older than the look-back window', async () => {
    const db = new MemoryDb();
    const r = await syncFromRivhit(db, fakeClient([
      doc(601, { is_closed: true }),
      doc(602, { document_date: '20/09/2026' }), // 18 days before "now"
      doc(603),
    ]), { documentType: DOC_TYPE, now });
    expect(r.imported).toBe(1);
    expect(await db.findOrderByExternalId('603')).toBeDefined();
  });

  it('keeps tracking an imported order after it falls out of the look-back window', async () => {
    const db = new MemoryDb();
    const docs = [doc(701, { document_date: '05/10/2026' })];
    await syncFromRivhit(db, fakeClient(docs), { documentType: DOC_TYPE, now }); // imported (3 days old)
    const later = () => new Date('2026-10-20T12:00:00Z'); // now 15 days old — outside the 7-day window
    let askedFrom: Date | undefined;
    const client = { ...fakeClient(docs), listDocuments: async (_t: number, from: Date) => { askedFrom = from; return docs.map(({ items: _i, ...d }) => ({ ...d, is_closed: true })); } };
    const r = await syncFromRivhit(db, client, { documentType: DOC_TYPE, now: later });
    expect(askedFrom!.getTime()).toBeLessThanOrEqual(new Date('2026-10-05T11:30:00Z').getTime()); // reaches back to the order itself
    expect(r.closed).toBe(1);
  });

  it('skips orders already cancelled before import', async () => {
    const db = new MemoryDb();
    const r = await syncFromRivhit(db, fakeClient([doc(301, { is_cancelled: true })]), { documentType: DOC_TYPE, now });
    expect(r).toMatchObject({ imported: 0, skipped: 1 });
  });

  it('alerts the manager about an order with no items', async () => {
    const db = new MemoryDb();
    await syncFromRivhit(db, fakeClient([doc(401, {}, [])]), { documentType: DOC_TYPE, now });
    expect(db.state.alerts[0].message).toContain('בלי פריטים');
  });

  it('caps detail calls per run and picks up the rest next time', async () => {
    const db = new MemoryDb();
    const client = fakeClient([doc(1), doc(2), doc(3)]);
    const r1 = await syncFromRivhit(db, client, { documentType: DOC_TYPE, now, maxNewPerRun: 2 });
    expect(r1).toMatchObject({ imported: 2, remaining: 1 });
    const r2 = await syncFromRivhit(db, client, { documentType: DOC_TYPE, now, maxNewPerRun: 2 });
    expect(r2).toMatchObject({ imported: 1, remaining: 0 });
  });

  it('records Rivhit failures so the manager sees them, and clears them on recovery', async () => {
    const db = new MemoryDb();
    const v0 = await db.version();
    const broken: RivhitClient = {
      listDocuments: async () => { throw new Error('Rivhit Document.List: invalid token'); },
      documentDetails: async () => ({}),
      listDocumentTypes: async () => [],
    };
    await expect(syncFromRivhit(db, broken, { documentType: DOC_TYPE, now })).rejects.toThrow();
    expect((await db.getSyncStatus()).lastError).toContain('invalid token');
    expect(await db.version()).toBeGreaterThan(v0); // open screens reload and show the warning

    await syncFromRivhit(db, fakeClient([]), { documentType: DOC_TYPE, now });
    expect((await db.getSyncStatus()).lastError).toBeNull();
  });
});

describe('Rivhit HTTP client', () => {
  it('posts the token and filters, and surfaces API errors', async () => {
    const seen: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, body: JSON.parse(init.body as string) });
      const body = seen.length === 1
        ? { error_code: 0, data: { document_list: [{ document_number: 5 }] } }
        : { error_code: 12, client_message: 'מסמך לא נמצא' };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;

    const client = createRivhitClient('TOKEN', fetchImpl, 'https://rivhit.test');
    const list = await client.listDocuments(7, new Date('2026-10-01T12:00:00Z'));
    expect(list).toEqual([{ document_number: 5 }]);
    expect(seen[0].url).toBe('https://rivhit.test/Document.List');
    expect(seen[0].body).toMatchObject({ api_token: 'TOKEN', from_document_type: 7, to_document_type: 7, from_date: '01/10/2026' });
    await expect(client.documentDetails(7, 5)).rejects.toThrow('מסמך לא נמצא');
  });
});

describe('API handler', () => {
  const setup = async () => {
    const db = new MemoryDb();
    await syncFromRivhit(db, fakeClient([doc(1, {}, [
      { line: 1, description: 'במבה', quantity: 10 },
      { line: 2, description: 'ביסלי', quantity: 4 },
    ])]), { documentType: DOC_TYPE, now: () => new Date('2026-10-08T12:00:00Z') });
    const handle = createHandler({ service: createOrderService(db), businessCode: 'S3cret', sync: async () => ({ imported: 3 }) });
    const call = (path: string, body?: unknown, headers: Record<string, string> = { 'x-business-code': 'S3cret' }) =>
      handle(new Request(`https://x.supabase.co/functions/v1/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
    return { db, call };
  };

  it('rejects requests without the right business code', async () => {
    const { call } = await setup();
    expect((await call('/snapshot', undefined, {})).status).toBe(401);
    expect((await call('/snapshot', undefined, { 'x-business-code': 'wrong' })).status).toBe(401);
  });

  it('lets the scheduler trigger /sync without a code, but reveals nothing', async () => {
    const { call } = await setup();
    const anon = await call('/sync', {}, {});
    expect(anon.status).toBe(200);
    expect(await anon.json()).toEqual({ ok: true });
    expect(await (await call('/sync', {})).json()).toEqual({ imported: 3 }); // with the code: details
    expect((await call('/snapshot', undefined, {})).status).toBe(401);
  });

  it('previews what Rivhit returns before the import is switched on', async () => {
    const client = fakeClient([doc(11, { is_closed: true }), doc(12), doc(13, { is_cancelled: true })]);
    const p = await previewRivhit(client, DOC_TYPE, () => new Date('2026-10-08T12:00:00Z'));
    expect(p.last14Days).toEqual({ total: 3, open: 1, closed: 1, cancelled: 1 });
    expect(p.newest[0]).toMatchObject({ number: 13, date: '08/10/2026', parsed: '2026-10-08T11:30:00.000Z' });
    expect(p.firstOpenItems).toEqual([{ line: 1, sku: 'B1', name: 'במבה', qty: 10 }]);
  });

  it('rate-limits sync runs', async () => {
    const db = new MemoryDb();
    let runs = 0;
    const run = async () => ++runs;
    const t0 = new Date('2026-10-14T10:00:00Z');
    await db.setSyncStatus({ lastSuccessAt: t0.toISOString() }, false);
    expect(await runSyncIfDue(db, run, 45_000, () => new Date(t0.getTime() + 10_000))).toEqual({ skipped: true });
    expect(await runSyncIfDue(db, run, 45_000, () => new Date(t0.getTime() + 60_000))).toBe(1);
  });

  it('runs the packing flow end to end', async () => {
    const { call } = await setup();
    const snap = await (await call('/snapshot')).json();
    expect(snap.orders).toHaveLength(1);
    expect(snap.sync.enabled).toBe(true); // a sync function is configured in this setup
    const [bamba, bisli] = snap.items;
    const orderId = snap.orders[0].id;

    // Can't finish with pending items.
    expect((await call(`/orders/${orderId}/complete`, { by: 'employee' })).status).toBe(409);

    await call(`/items/${bamba.id}/state`, { state: 'packed', by: 'employee' });
    const r = await call(`/items/${bisli.id}/state`, { state: 'missing', quantityMissing: 99, by: 'employee' });
    expect((await r.json()).quantityMissing).toBe(4); // clamped to what was ordered

    const mid = await (await call('/snapshot')).json();
    expect(mid.alerts.filter((a: { type: string }) => a.type === 'missing_item')).toHaveLength(1);
    expect(mid.orders[0].status).toBe('in_progress');

    const done = await call(`/orders/${orderId}/complete`, { by: 'employee' });
    expect(done.status).toBe(200);
    expect((await done.json()).status).toBe('ready_to_ship');

    // A finished order can't be changed by a stale screen.
    expect((await call(`/items/${bamba.id}/state`, { state: 'pending', by: 'employee' })).status).toBe(409);

    // Manager marks it shipped — only once, and only from "ready to ship".
    const shipped = await call(`/orders/${orderId}/ship`, { by: 'manager' });
    expect((await shipped.json()).status).toBe('shipped');
    expect((await call(`/orders/${orderId}/ship`, { by: 'manager' })).status).toBe(409);
  });

  it('bumps the version on changes so other phones reload', async () => {
    const { call } = await setup();
    const v1 = (await (await call('/version')).json()).version;
    const snap = await (await call('/snapshot')).json();
    await call(`/orders/${snap.orders[0].id}/issues`, { message: 'פריט פגום', by: 'employee' });
    const v2 = (await (await call('/version')).json()).version;
    expect(v2).toBeGreaterThan(v1);
  });
});
