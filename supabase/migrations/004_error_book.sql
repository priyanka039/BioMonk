-- ============================================================
-- BioMonk LMS — Error Book (mistake notebook)
-- Stores wrong answers when a student completes a test.
-- Capture is automatic via trigger — no app code changes needed.
-- ============================================================

-- ─── error_book_entries ──────────────────────────────────────
create table if not exists error_book_entries (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id) on delete cascade,
  question_id     uuid not null references questions(id) on delete cascade,
  attempt_id      uuid not null references test_attempts(id) on delete cascade,
  test_id         uuid not null references tests(id) on delete cascade,
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  correct_option  text not null check (correct_option in ('A', 'B', 'C', 'D')),
  notes           text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (student_id, question_id)
);

create index if not exists error_book_entries_student_id_idx
  on error_book_entries (student_id);

create index if not exists error_book_entries_student_unresolved_idx
  on error_book_entries (student_id)
  where resolved_at is null;

-- ─── Sync mistakes when a test attempt is submitted ─────────
create or replace function sync_error_book_on_attempt_complete()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.is_completed = true and (old.is_completed is distinct from true) then
    insert into error_book_entries (
      student_id,
      question_id,
      attempt_id,
      test_id,
      selected_option,
      correct_option
    )
    select
      new.student_id,
      tr.question_id,
      new.id,
      new.test_id,
      tr.selected_option,
      q.correct_option
    from test_responses tr
    join questions q on q.id = tr.question_id
    where tr.attempt_id = new.id
      and tr.selected_option is not null
      and tr.selected_option != q.correct_option
    on conflict (student_id, question_id) do update set
      attempt_id = excluded.attempt_id,
      test_id = excluded.test_id,
      selected_option = excluded.selected_option,
      correct_option = excluded.correct_option,
      created_at = now(),
      resolved_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_test_attempt_completed_sync_error_book on test_attempts;
create trigger on_test_attempt_completed_sync_error_book
  after update on test_attempts
  for each row
  execute procedure sync_error_book_on_attempt_complete();

-- ─── Backfill historical mistakes from completed attempts ─────
insert into error_book_entries (
  student_id,
  question_id,
  attempt_id,
  test_id,
  selected_option,
  correct_option,
  created_at
)
select distinct on (ta.student_id, tr.question_id)
  ta.student_id,
  tr.question_id,
  ta.id,
  ta.test_id,
  tr.selected_option,
  q.correct_option,
  coalesce(ta.submitted_at, ta.started_at)
from test_attempts ta
join test_responses tr on tr.attempt_id = ta.id
join questions q on q.id = tr.question_id
where ta.is_completed = true
  and tr.selected_option is not null
  and tr.selected_option != q.correct_option
order by ta.student_id, tr.question_id, coalesce(ta.submitted_at, ta.started_at) desc
on conflict (student_id, question_id) do nothing;

-- ─── Row Level Security ───────────────────────────────────────
alter table error_book_entries enable row level security;

create policy "Students read own error book"
  on error_book_entries for select
  using (student_id = auth.uid());

create policy "Students insert own error book"
  on error_book_entries for insert
  with check (student_id = auth.uid());

create policy "Students update own error book"
  on error_book_entries for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "Students delete own error book"
  on error_book_entries for delete
  using (student_id = auth.uid());
