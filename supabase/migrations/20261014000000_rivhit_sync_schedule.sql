-- Pull new orders from Rivhit every 2 minutes by calling the "api" Edge Function.
-- No secret needed: /sync only pulls from Rivhit, returns nothing to anonymous callers,
-- and skips runs that come less than 45 s after the previous one.
-- Replace <your-project-ref> below with your Supabase project ref before `supabase db push`.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'rivhit-sync',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://<your-project-ref>.supabase.co/functions/v1/api/sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Check it runs:  select * from cron.job_run_details order by start_time desc limit 5;
-- Stop it:        select cron.unschedule('rivhit-sync');
