create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table user_profiles
  add column if not exists is_premium boolean default false;

create table if not exists admin_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

drop trigger if exists admin_state_updated_at on admin_state;
create trigger admin_state_updated_at
  before update on admin_state
  for each row execute function update_updated_at();

alter table admin_state enable row level security;

drop policy if exists "allow_all_admin_state" on admin_state;
create policy "allow_all_admin_state"
  on admin_state for all
  using (true)
  with check (true);

update user_profiles
set is_premium = true,
    updated_at = now()
where id = '0cdabd72-bcc5-4e31-9496-fe1ad8e7c79a';
