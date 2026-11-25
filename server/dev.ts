/**
 * Local stand-in for the Supabase Edge Function: same API code, in-memory database.
 *
 *   npm run server      → http://localhost:8787/api  (business code from .env.server, default 1234)
 *   npm run dev:live    → the app, talking to this server
 *
 * With RIVHIT_API_TOKEN + RIVHIT_ORDER_DOC_TYPE in .env.server it reads your REAL Rivhit
 * orders (read-only). Without them it uses a fake Rivhit with sample orders.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { MemoryDb } from '../supabase/functions/_shared/memoryDb.ts';
import { createOrderService } from '../supabase/functions/_shared/service.ts';
import { createHandler } from '../supabase/functions/_shared/handler.ts';
import { createRivhitClient, runSyncIfDue, syncFromRivhit } from '../supabase/functions/_shared/rivhit.ts';
import { createFakeRivhit } from './fakeRivhit.ts';

function loadEnvFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnvFile('.env.server'), ...process.env } as Record<string, string | undefined>;
const PORT = Number(env.PORT) || 8787;
const businessCode = env.BUSINESS_CODE || '1234';
const realRivhit = !!env.RIVHIT_API_TOKEN && !!env.RIVHIT_ORDER_DOC_TYPE;
const documentType = Number(env.RIVHIT_ORDER_DOC_TYPE) || 7;

const db = new MemoryDb();
const rivhit = realRivhit ? createRivhitClient(env.RIVHIT_API_TOKEN!) : createFakeRivhit(documentType);

const sync = async () => {
  const result = await syncFromRivhit(db, rivhit, { documentType, lookbackDays: Number(env.RIVHIT_LOOKBACK_DAYS) || 7 });
  if (result.imported || result.cancelled) console.log(`[sync] imported ${result.imported}, cancelled ${result.cancelled}`);
  return result;
};

// Same rule as production: HTTP-triggered syncs are rate-limited.
const handle = createHandler({ service: createOrderService(db), businessCode, sync: () => runSyncIfDue(db, sync) });

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? undefined : Buffer.concat(chunks),
  });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}/api  (Rivhit: ${realRivhit ? 'REAL, read-only' : 'fake sample data'})`);
});

// Same schedule idea as production (Supabase cron): pull from Rivhit every minute.
const runSync = () => sync().catch((e) => console.error('[sync] failed:', e instanceof Error ? e.message : e));
void runSync();
setInterval(runSync, 60_000);
