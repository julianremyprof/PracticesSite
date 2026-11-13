create or replace view public.practice_student_drill_skill_insights
with (security_invoker=true)
as
with drill_answers as (
  select
    a.student_id,
    case
      when a.topic like 'conjunctions/%' then 'conjunctions/linking-words'
      else a.topic
    end as topic,
    a.activity_id,
    a.question_text,
    a.selected_answer,
    a.correct_answer,
    a.is_correct,
    a.error_type,
    a.time_to_answer_seconds,
    a.answered_at
  from public.practice_answers a
  where a.activity_id = any(array[
    'toeic-part5-drill-1',
    'toeic-part5-drill-2',
    'toeic-part5-drill-3',
    'toeic-part5-drill-4'
  ]::text[])
)
select
  student_id,
  topic,
  count(distinct activity_id) as drills_attempted,
  count(*) as attempts,
  count(*) filter (where is_correct=true) as correct_attempts,
  count(*) filter (where is_correct=false) as incorrect_attempts,
  round(100.0*count(*) filter (where is_correct=false)::numeric/nullif(count(*),0)::numeric,1) as error_rate,
  count(distinct question_text) as questions_practiced,
  (
    select coalesce(x.error_type,'unclassified')
    from drill_answers x
    where x.student_id=a.student_id and x.topic=a.topic and x.is_correct=false
    group by x.error_type
    order by count(*) desc,coalesce(x.error_type,'unclassified')
    limit 1
  ) as most_common_error,
  avg(time_to_answer_seconds) filter (where time_to_answer_seconds is not null) as avg_time_to_answer_seconds,
  count(*) filter (where lower(coalesce(selected_answer,''))='time expired') as timed_out_answers,
  count(*) filter (where lower(coalesce(selected_answer,''))='skipped') as skipped_answers,
  max(answered_at) as last_practiced
from drill_answers a
group by student_id,topic;
