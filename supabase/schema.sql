-- PsychoTechniPlus — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run

-- ── Targets ────────────────────────────────────────────────────────────────
create table if not exists targets (
  id text primary key,
  name text not null,
  slug text,
  description text,
  icon text,
  color text,
  gradient_colors jsonb,
  order_index int default 0,
  total_questions int default 0,
  free_questions_count int default 0,
  is_premium_only boolean default false,
  is_active boolean default true,
  coming_soon boolean default false,
  access_settings jsonb,
  created_at timestamptz default now()
);

-- ── Topics ──────────────────────────────────────────────────────────────────
create table if not exists topics (
  id text primary key,
  target_id text references targets(id) on delete cascade,
  name text not null,
  slug text,
  description text,
  icon text,
  order_index int default 0,
  is_premium_only boolean default false,
  color text,
  created_at timestamptz default now()
);

-- ── Questions ──────────────────────────────────────────────────────────────
create table if not exists questions (
  id text primary key,
  target_ids text[] default '{}',
  topic_id text references topics(id) on delete set null,
  subtopic_id text,
  question_type text default 'multiple_choice',
  question_text text not null,
  reading_passage text,
  media_url text,
  media_type text,
  options jsonb not null default '[]',
  correct_answer text not null,
  explanation text default '',
  difficulty int default 3,
  psychometric_stats jsonb default '{"elo":1200,"discrimination":0.7,"guessProbability":0.25}',
  access_level text default 'free',
  validation_status text default 'draft',
  smart_practice_eligible boolean default false,
  general_practice_eligible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger questions_updated_at
  before update on questions
  for each row execute function update_updated_at();

-- ── User Profiles ──────────────────────────────────────────────────────────
create table if not exists user_profiles (
  id text primary key,
  name text default '',
  selected_target_id text,
  has_completed_onboarding boolean default false,
  streak int default 0,
  longest_streak int default 0,
  last_practiced_date text,
  level int default 1,
  xp int default 0,
  total_sessions int default 0,
  total_correct int default 0,
  total_answered int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute function update_updated_at();

-- ── User ELOs ──────────────────────────────────────────────────────────────
create table if not exists user_elos (
  id bigserial primary key,
  user_id text references user_profiles(id) on delete cascade,
  topic_id text not null,
  elo int default 1200,
  history jsonb default '[]',
  updated_at timestamptz default now(),
  unique(user_id, topic_id)
);

-- ── User Badges ────────────────────────────────────────────────────────────
create table if not exists user_badges (
  id text primary key,
  user_id text references user_profiles(id) on delete cascade,
  badge_type text not null,
  earned_at timestamptz default now(),
  metadata jsonb,
  unique(user_id, badge_type)
);

-- ── Practice Sessions ─────────────────────────────────────────────────────
create table if not exists practice_sessions (
  id text primary key,
  user_id text references user_profiles(id) on delete cascade,
  user_name text,
  target_id text,
  topic_id text,
  mode text default 'practice',
  template_id text,
  template_name text,
  total_questions int default 0,
  correct_answers int default 0,
  skipped_questions int default 0,
  score numeric(5,2) default 0,
  time_spent_seconds int default 0,
  answers jsonb default '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table practice_sessions enable row level security;
create policy "allow_all_practice_sessions" on practice_sessions for all using (true) with check (true);

-- ── Row Level Security (open for dev — lock down before production) ────────
alter table targets enable row level security;
alter table topics enable row level security;
alter table questions enable row level security;
alter table user_profiles enable row level security;
alter table user_elos enable row level security;
alter table user_badges enable row level security;

create policy "allow_all_targets"       on targets       for all using (true) with check (true);
create policy "allow_all_topics"        on topics        for all using (true) with check (true);
create policy "allow_all_questions"     on questions     for all using (true) with check (true);
create policy "allow_all_user_profiles" on user_profiles for all using (true) with check (true);
create policy "allow_all_user_elos"     on user_elos     for all using (true) with check (true);
create policy "allow_all_user_badges"   on user_badges   for all using (true) with check (true);

-- ── Migrations (safe to re-run on existing DB) ─────────────────────────────
-- Fix questions.topic_id FK to SET NULL on topic delete (instead of blocking)
do $$ begin
  alter table questions drop constraint if exists questions_topic_id_fkey;
  alter table questions
    add constraint questions_topic_id_fkey
    foreign key (topic_id) references topics(id) on delete set null;
exception when others then null; end $$;

-- Add unique constraint for user_badges (user_id, badge_type) — prevents duplicate badges
do $$ begin
  alter table user_badges add constraint user_badges_user_id_badge_type_key unique (user_id, badge_type);
exception when duplicate_table then null;
         when others then null; end $$;
