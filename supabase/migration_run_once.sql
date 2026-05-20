-- ══════════════════════════════════════════════════════════════════════════
-- PsychoTechniPlus — Migration (הרץ פעם אחת על DB קיים)
-- Supabase Dashboard → SQL Editor → New Query → הדבק הכל → Run
-- ══════════════════════════════════════════════════════════════════════════

-- 1. צור טבלת practice_sessions אם לא קיימת
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

-- RLS על practice_sessions
alter table practice_sessions enable row level security;

do $$ begin
  create policy "allow_all_practice_sessions"
    on practice_sessions for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 2. תקן FK של questions.topic_id → SET NULL בעת מחיקת נושא
--    (ברירת מחדל הייתה RESTRICT — מחיקת נושא עם שאלות הייתה נכשלת בשקט)
do $$ begin
  alter table questions drop constraint if exists questions_topic_id_fkey;
  alter table questions
    add constraint questions_topic_id_fkey
    foreign key (topic_id) references topics(id) on delete set null;
exception when others then null; end $$;

-- 3. הוסף UNIQUE(user_id, badge_type) ל-user_badges — מונע תגים כפולים
do $$ begin
  alter table user_badges
    add constraint user_badges_user_id_badge_type_key
    unique (user_id, badge_type);
exception when duplicate_table then null;
         when duplicate_object then null;
         when others then null; end $$;

-- 4. ודא שה-updated_at trigger קיים (בטוח להריץ שוב)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- סיום — הכל בוצע בהצלחה ✓
select 'migration completed successfully' as status;
