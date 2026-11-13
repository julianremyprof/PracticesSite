-- Optional percentage threshold for each assigned practice.
-- A null value preserves the existing behavior: any completed attempt completes the assignment.
alter table public.practice_assignments
  add column if not exists required_score numeric(5,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.practice_assignments'::regclass
      and conname = 'practice_assignments_required_score_range_check'
  ) then
    alter table public.practice_assignments
      add constraint practice_assignments_required_score_range_check
      check (required_score is null or required_score between 0 and 100);
  end if;
end
$$;

comment on column public.practice_assignments.required_score is
  'Minimum required accuracy percentage (0–100) for the assignment to count as completed; null means no threshold.';

drop policy if exists "Assigned staff update practice assignment score requirements"
  on public.practice_assignments;

create policy "Assigned staff update practice assignment score requirements"
  on public.practice_assignments
  for update
  to authenticated
  using (
    assigned_by = (select auth.uid())
    and (
      (select private.is_admin())
      or (select private.teacher_can_access_student(practice_assignments.student_id))
    )
  )
  with check (
    assigned_by = (select auth.uid())
    and (
      (select private.is_admin())
      or (select private.teacher_can_access_student(practice_assignments.student_id))
    )
  );
