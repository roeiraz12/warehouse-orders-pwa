// Supabase Edge Function "api" — the cloud backend for the order app.
// Deploy:  npx supabase functions deploy api --no-verify-jwt
// Secrets (Dashboard → Edge Functions → Secrets): BUSINESS_CODE, RIVHIT_API_TOKEN, RIVHIT_ORDER_DOC_TYPE

import { createClient } from 'npm:@supabase/supabase-js@2';
import { SupabaseDb } from './supabaseDb.ts';
import { createOrderService } from '../_shared/service.ts';
import { createHandler } from '../_shared/handler.ts';
import { createRivhitClient, previewRivhit, runSyncIfDue, syncFromRivhit } from '../_shared/rivhit.ts';

const env = (k: string) => Deno.env.get(k) ?? '';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const db = new SupabaseDb(supabase);

const rivhitToken = env('RIVHIT_API_TOKEN');
const docType = Number(env('RIVHIT_ORDER_DOC_TYPE'));
const sync = rivhitToken && docType
  ? () => runSyncIfDue(db, () => syncFromRivhit(db, createRivhitClient(rivhitToken), {
      documentType: docType,
      lookbackDays: Number(env('RIVHIT_LOOKBACK_DAYS')) || 7,
    }))
  : undefined;

const rivhitClient = rivhitToken ? createRivhitClient(rivhitToken) : undefined;

const handler = createHandler({
  service: createOrderService(db),
  businessCode: env('BUSINESS_CODE'),
  sync,
  rivhit: rivhitClient && {
    types: () => rivhitClient.listDocumentTypes(),
    preview: (type) => previewRivhit(rivhitClient, type),
  },
});

Deno.serve(handler);
