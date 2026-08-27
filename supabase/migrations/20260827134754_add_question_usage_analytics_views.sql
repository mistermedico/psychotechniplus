create or replace view public.practice_answer_events
with (security_invoker = true) as
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
from public.practice_sessions ps
cross join lateral jsonb_array_elements(coalesce(ps.answers, '[]'::jsonb)) with ordinality as answer_item(value, answer_index)
left join public.questions q on q.id = answer_item.value ->> 'questionId';

create or replace view public.question_usage_stats
with (security_invoker = true) as
select
  question_id,
  max(question_text) as question_text,
  max(question_topic_id) as topic_id,
  count(*)::int as attempts,
  sum(case when is_correct then 1 else 0 end)::int as correct_count,
  sum(case when is_skipped then 1 else 0 end)::int as skipped_count,
  round(avg(time_spent_seconds))::int as avg_time_seconds,
  round(100.0 * avg(case when is_correct then 1 else 0 end))::int as correct_rate
from public.practice_answer_events
where question_id is not null
group by question_id;

grant select on public.practice_answer_events to anon, authenticated;
grant select on public.question_usage_stats to anon, authenticated;
