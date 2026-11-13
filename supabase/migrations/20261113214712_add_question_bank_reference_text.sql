-- Store reading passages and context alongside their editable questions.
alter table public.question_bank
  add column if not exists reference_text text;

comment on column public.question_bank.reference_text is
  'Passage, source text, or reading context associated with a question, such as a TOEIC Part 6 text.';
