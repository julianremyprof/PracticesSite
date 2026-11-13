-- Allow teachers to remove their own student practice assignments.
-- Existing SELECT visibility and student-access checks remain in force.
grant delete on table public.practice_assignments to authenticated;

drop policy if exists "Assigned staff delete practice assignments"
  on public.practice_assignments;

create policy "Assigned staff delete practice assignments"
  on public.practice_assignments
  for delete
  to authenticated
  using (
    assigned_by = (select auth.uid())
    and (
      (select private.is_admin())
      or (select private.teacher_can_access_student(practice_assignments.student_id))
    )
  );
