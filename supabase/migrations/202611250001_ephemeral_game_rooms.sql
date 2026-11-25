-- Ephemeral room storage. Nicknames, player IDs, scores and words exist only
-- while a room is active. No client can read/write this table directly.
create table if not exists public.game_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  state jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.game_rooms enable row level security;
revoke all on public.game_rooms from anon, authenticated;
-- Realtime publishes only row-change notifications; clients fetch snapshots
-- through the Edge Function. Do not add a permissive SELECT policy.
do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

create index if not exists game_rooms_expiry_idx on public.game_rooms(expires_at);

-- Expired room cleanup is also performed opportunistically by the Edge Function.
-- Optional scheduled cleanup can be enabled with pg_cron if available on your plan:
-- select cron.schedule('purge-expired-game-rooms','*/5 * * * *',
--   $$delete from public.game_rooms where expires_at < now()$$);
