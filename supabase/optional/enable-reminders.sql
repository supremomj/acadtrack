-- Optional: run once as the project owner in Supabase SQL Editor.
-- This keeps in-app deadline reminders, daily metrics and weekly summaries
-- running every ten minutes without depending on a paid Vercel cron plan.
-- Apply migrations 001, 002 and 003 before this script.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'acadtrack-academic-reminders',
  '*/10 * * * *',
  $job$select public.capture_academic_summaries(); select public.enqueue_reminders();$job$
);
-- Verify the job in Integrations → Cron or with:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'acadtrack-academic-reminders';
-- This job creates in-app notifications. Push/email delivery still needs
-- a scheduled authenticated HTTP call to /api/cron/reminders and configured
-- server-side credentials, VAPID keys and/or email provider credentials.
