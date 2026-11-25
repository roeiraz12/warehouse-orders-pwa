/**
 * Lists the document types in YOUR Rivhit account, so we know which number means "order".
 *   1. Put RIVHIT_API_TOKEN=... in .env.server
 *   2. npm run rivhit:types
 * Read-only. Prints only type numbers and names (no customer data).
 */
import { readFileSync } from 'node:fs';
import { RIVHIT_BASE_URL } from '../supabase/functions/_shared/rivhit.ts';

const fromFile = (() => {
  try {
    return /^\s*RIVHIT_API_TOKEN\s*=\s*["']?([^"'\r\n]+)/m.exec(readFileSync('.env.server', 'utf8'))?.[1];
  } catch {
    return undefined;
  }
})();
const token = process.env.RIVHIT_API_TOKEN || fromFile;
if (!token) {
  console.error('Missing RIVHIT_API_TOKEN in .env.server');
  process.exit(1);
}

const res = await fetch(`${RIVHIT_BASE_URL}/Document.TypeList`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_token: token }),
});
const json = (await res.json()) as {
  error_code?: number;
  client_message?: string;
  data?: { document_type_list?: { document_type: number; document_name: string }[] };
};
if (json.error_code) {
  console.error('Rivhit error:', json.client_message);
  process.exit(1);
}
console.log('Document types in your Rivhit account:\n');
for (const t of json.data?.document_type_list ?? []) console.log(`  ${String(t.document_type).padStart(4)}  ${t.document_name}`);
console.log('\nPut the number of your "order" type in RIVHIT_ORDER_DOC_TYPE.');
