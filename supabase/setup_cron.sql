-- Run this manually in the Supabase SQL Editor AFTER deploying the
-- send-due-notifications edge function (supabase functions deploy send-due-notifications).
--
-- Replace the two values below with your project's Project URL and anon public key
-- (Project Settings -> API), then run the whole script once.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<anon_public_key>', 'api_key');

select cron.schedule(
  'send-due-notifications',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-due-notifications',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'api_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- To inspect scheduled jobs:
--   select * from cron.job;
-- To remove this job later:
--   select cron.unschedule('send-due-notifications');
