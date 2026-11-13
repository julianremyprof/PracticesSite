-- Rank-based avatar completion bonuses for future practice sessions.
-- Correct-answer rewards remain handled by private.award_correct_practice_answer_points().
-- The existing practice_completion unique key keeps this reward idempotent per session.

create or replace function private.reward_avatar_coins_for_completed_session()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  reward integer := 0;
  rank_code text;
  accuracy numeric;
  inserted_id uuid;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if new.student_id is null or new.total_questions is null or new.total_questions < 1 then
    return new;
  end if;

  accuracy := coalesce(new.score, 0)::numeric * 100 / new.total_questions::numeric;

  if accuracy > 97 then
    rank_code := 'SSS';
    reward := 150;
  elsif accuracy > 90 then
    rank_code := 'A';
    reward := 100;
  elsif accuracy > 80 then
    rank_code := 'B';
    reward := 90;
  elsif accuracy > 70 then
    rank_code := 'C';
    reward := 80;
  elsif accuracy > 60 then
    rank_code := 'D';
  elsif accuracy > 50 then
    rank_code := 'E';
  elsif accuracy > 40 then
    rank_code := 'F';
  elsif accuracy > 30 then
    rank_code := 'G';
  elsif accuracy > 20 then
    rank_code := 'H';
  elsif accuracy > 10 then
    rank_code := 'I';
  else
    rank_code := 'J';
  end if;

  -- Completion bonuses begin at C (>70%). Correct-answer points are handled
  -- separately by the practice_answers trigger and are not changed here.
  if reward <= 0 then
    return new;
  end if;

  insert into public.avatar_coin_ledger(student_id, amount, source_type, source_id, description)
  values (
    new.student_id,
    reward,
    'practice_completion',
    new.id,
    rank_code || ' rank completion bonus (' || round(accuracy, 2)::text || '% accuracy)'
  )
  on conflict (source_type, source_id) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    insert into public.avatar_wallets(student_id, balance)
    values (new.student_id, 500)
    on conflict (student_id) do nothing;

    update public.avatar_wallets
    set balance = balance + reward, updated_at = now()
    where student_id = new.student_id;
  end if;

  return new;
end;
$function$;
