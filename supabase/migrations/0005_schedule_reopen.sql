-- Reopen tasks with no update for 3 days, checked every hour.
create extension if not exists pg_cron;

select cron.schedule(
  'reopen-stale-tasks',
  '17 * * * *',
  $$select public.reopen_stale_tasks()$$
);
