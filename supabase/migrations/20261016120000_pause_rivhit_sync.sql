-- PAUSED 2026-10-16 at the owner's request, while Rivhit confirms API read-call pricing/limits.
-- To resume: add a new migration that runs the cron.schedule(...) from
-- 20261014000000_rivhit_sync_schedule.sql again, and set the RIVHIT_ORDER_DOC_TYPE=7 secret.
select cron.unschedule('rivhit-sync');
