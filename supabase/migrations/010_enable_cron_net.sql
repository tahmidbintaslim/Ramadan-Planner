-- Applied to production 2026-11-09 (founder approved): scheduler + HTTP extensions for the reminder dispatcher.
create extension if not exists pg_net;
create extension if not exists pg_cron;
