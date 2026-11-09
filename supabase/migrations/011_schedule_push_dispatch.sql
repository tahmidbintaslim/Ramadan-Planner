-- Applied to production 2026-11-09. Every 5 minutes: GET /api/push/dispatch with the Bearer secret read from the
-- vault at run time. The secret itself is never in this file: it was stored once with
--   select vault.create_secret('<same value as the Vercel CRON_SECRET>', 'cron_secret');
-- To rotate: update the vault secret and the Vercel env var together, then redeploy.
select cron.schedule(
  'push-dispatch-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://ramadanplanner.tahmid.space/api/push/dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    timeout_milliseconds := 30000
  );
  $$
);
