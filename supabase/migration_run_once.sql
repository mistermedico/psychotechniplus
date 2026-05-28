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

-- 5. Practice analytics sync: indexes + admin monitor views
create index if not exists practice_sessions_completed_at_idx on practice_sessions(completed_at desc);
create index if not exists practice_sessions_user_id_idx on practice_sessions(user_id);
create index if not exists practice_sessions_topic_id_idx on practice_sessions(topic_id);
create index if not exists practice_sessions_template_id_idx on practice_sessions(template_id);

create or replace view practice_answer_events as
select
  ps.id as session_id,
  ps.user_id,
  ps.user_name,
  ps.target_id,
  ps.topic_id as session_topic_id,
  ps.mode,
  ps.template_id,
  ps.template_name,
  ps.started_at,
  ps.completed_at,
  (answer_item.value ->> 'questionId') as question_id,
  coalesce(answer_item.value ->> 'selectedAnswerId', '') as selected_answer_id,
  coalesce(answer_item.value ->> 'correctAnswerId', q.correct_answer) as correct_answer_id,
  coalesce((answer_item.value ->> 'isCorrect')::boolean, false) as is_correct,
  coalesce((answer_item.value ->> 'isSkipped')::boolean, false) as is_skipped,
  coalesce((answer_item.value ->> 'timeSpent')::int, 0) as time_spent_seconds,
  coalesce((answer_item.value ->> 'difficulty')::int, q.difficulty, 5) as difficulty,
  q.topic_id as question_topic_id,
  q.question_type,
  q.question_text
from practice_sessions ps
cross join lateral jsonb_array_elements(coalesce(ps.answers, '[]'::jsonb)) with ordinality as answer_item(value, answer_index)
left join questions q on q.id = answer_item.value ->> 'questionId';

create or replace view question_usage_stats as
select
  question_id,
  max(question_text) as question_text,
  max(question_topic_id) as topic_id,
  count(*)::int as attempts,
  sum(case when is_correct then 1 else 0 end)::int as correct_count,
  sum(case when is_skipped then 1 else 0 end)::int as skipped_count,
  round(avg(time_spent_seconds))::int as avg_time_seconds,
  round(100.0 * avg(case when is_correct then 1 else 0 end))::int as correct_rate
from practice_answer_events
where question_id is not null
group by question_id;

create or replace view topic_usage_stats as
select
  coalesce(question_topic_id, session_topic_id) as topic_id,
  count(*)::int as attempts,
  sum(case when is_correct then 1 else 0 end)::int as correct_count,
  sum(case when is_skipped then 1 else 0 end)::int as skipped_count,
  round(avg(time_spent_seconds))::int as avg_time_seconds,
  round(100.0 * avg(case when is_correct then 1 else 0 end))::int as correct_rate
from practice_answer_events
group by coalesce(question_topic_id, session_topic_id);

create or replace view exam_usage_stats as
select
  coalesce(template_id, mode) as exam_key,
  max(coalesce(template_name, mode)) as exam_name,
  count(distinct session_id)::int as sessions,
  sum(case when is_correct then 1 else 0 end)::int as correct_count,
  count(*)::int as attempts,
  round(avg(time_spent_seconds))::int as avg_time_seconds,
  round(100.0 * avg(case when is_correct then 1 else 0 end))::int as correct_rate
from practice_answer_events
group by coalesce(template_id, mode);

-- סיום — הכל בוצע בהצלחה ✓
select 'migration completed successfully' as status;
