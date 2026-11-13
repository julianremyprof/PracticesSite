-- Register the TOEIC Part 6 skill practices and full drills.
-- These IDs must match document.body.dataset.activityId in the practice pages.
-- The rows are upserted so this script can be safely re-run.

insert into public.activities (id, title, category, question_count, path, active)
values
  ('toeic-part6-skill-text-type', 'TOEIC Part 6 · Skill · Text Type', 'TOEIC', 10, 'practices/toeic-part6-skill.html?skill=text-type', true),
  ('toeic-part6-skill-context', 'TOEIC Part 6 · Skill · Context', 'TOEIC', 10, 'practices/toeic-part6-skill.html?skill=context', true),
  ('toeic-part6-skill-blank-function', 'TOEIC Part 6 · Skill · Blank Function', 'TOEIC', 10, 'practices/toeic-part6-skill.html?skill=blank-function', true),
  ('toeic-part6-skill-elimination', 'TOEIC Part 6 · Skill · Elimination', 'TOEIC', 10, 'practices/toeic-part6-skill.html?skill=elimination', true),
  ('toeic-part6-drill-1', 'TOEIC Part 6 · Drill 1', 'TOEIC', 16, 'practices/toeic-part6-drills.html?drill=1', true),
  ('toeic-part6-drill-2', 'TOEIC Part 6 · Drill 2', 'TOEIC', 16, 'practices/toeic-part6-drills.html?drill=2', true),
  ('toeic-part6-drill-3', 'TOEIC Part 6 · Drill 3', 'TOEIC', 16, 'practices/toeic-part6-drills.html?drill=3', true),
  ('toeic-part6-drill-4', 'TOEIC Part 6 · Drill 4', 'TOEIC', 16, 'practices/toeic-part6-drills.html?drill=4', true)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  question_count = excluded.question_count,
  path = excluded.path,
  active = true;
