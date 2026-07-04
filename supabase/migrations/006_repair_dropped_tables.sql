-- ============================================================
-- BioMonk LMS — Migration 006: Repair Dropped Tables
-- ------------------------------------------------------------
-- CONTEXT: The tables `batches`, `profiles`, `waitlist`, and
-- `error_book_entries` were dropped from this database at some
-- point (the surviving tables that referenced them lost their
-- foreign keys as a side effect). This migration recreates ONLY
-- the missing structure so the app + migration 005 work again.
--
-- RUN ORDER: run this BEFORE 005_admin_panel.sql.
--
-- SAFETY: Idempotent + additive. It only CREATEs missing tables
-- (create table if not exists) and re-adds missing policies /
-- triggers / FKs with guards. It does NOT drop or rewrite any
-- data in the surviving tables. Re-adding the FKs uses NOT VALID
-- so it can never fail on pre-existing orphan rows.
--
-- NOTE: Rows that were in batches/profiles are already gone and
-- cannot be recovered here — you'll need to recreate your batches
-- and re-enroll students afterwards.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── batches ────────────────────────────────────────────────
create table if not exists batches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default true
);
-- created_at was added by migration 002
alter table batches add column if not exists created_at timestamptz not null default now();

-- ─── profiles ───────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  batch_id    uuid references batches(id),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ─── waitlist ───────────────────────────────────────────────
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ─── error_book_entries (depends on profiles) ───────────────
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

-- ─── Ensure surviving tables have columns from 002 / 003 ─────
alter table tests         add column if not exists created_at timestamptz not null default now();
alter table test_attempts add column if not exists max_score  integer;

-- ─── Row Level Security ─────────────────────────────────────
alter table batches            enable row level security;
alter table profiles           enable row level security;
alter table waitlist           enable row level security;
alter table error_book_entries enable row level security;

-- ─── Helper function (students → their batch) ───────────────
create or replace function get_my_batch_id()
returns uuid language sql security definer as $$
  select batch_id from profiles where id = auth.uid()
$$;

-- ─── batches policies ───────────────────────────────────────
drop policy if exists "Students see own batch" on batches;
create policy "Students see own batch"
  on batches for select
  using (id = get_my_batch_id());

-- ─── profiles policies ──────────────────────────────────────
drop policy if exists "Students read own profile" on profiles;
create policy "Students read own profile"
  on profiles for select
  using (id = auth.uid());

drop policy if exists "Students update own profile" on profiles;
create policy "Students update own profile"
  on profiles for update
  using (id = auth.uid());

drop policy if exists "Service role can manage profiles" on profiles;
create policy "Service role can manage profiles"
  on profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─── waitlist policy ────────────────────────────────────────
drop policy if exists "Anyone can join waitlist" on waitlist;
create policy "Anyone can join waitlist"
  on waitlist for insert
  with check (true);

-- ─── error_book_entries policies ────────────────────────────
drop policy if exists "Students read own error book" on error_book_entries;
create policy "Students read own error book"
  on error_book_entries for select
  using (student_id = auth.uid());

drop policy if exists "Students insert own error book" on error_book_entries;
create policy "Students insert own error book"
  on error_book_entries for insert
  with check (student_id = auth.uid());

drop policy if exists "Students update own error book" on error_book_entries;
create policy "Students update own error book"
  on error_book_entries for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "Students delete own error book" on error_book_entries;
create policy "Students delete own error book"
  on error_book_entries for delete
  using (student_id = auth.uid());

-- ─── Auto-create profile on new auth user ───────────────────
-- SECURITY DEFINER + pinned search_path: without `set search_path`,
-- Supabase Auth's session can't resolve the unqualified `profiles`
-- table when this trigger fires, which surfaces as the generic
-- "Database error creating new user" during signup / admin create.
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Error book sync trigger (from migration 004) ───────────
create or replace function sync_error_book_on_attempt_complete()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.is_completed = true and (old.is_completed is distinct from true) then
    insert into error_book_entries (
      student_id, question_id, attempt_id, test_id, selected_option, correct_option
    )
    select
      new.student_id, tr.question_id, new.id, new.test_id, tr.selected_option, q.correct_option
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

-- ─── Re-link foreign keys stripped when the tables were dropped ─
-- NOT VALID: enforces the FK for future writes without scanning
-- (and thus without failing on) any pre-existing orphan rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chapters_batch_id_fkey') then
    alter table chapters add constraint chapters_batch_id_fkey
      foreign key (batch_id) references batches(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tests_batch_id_fkey') then
    alter table tests add constraint tests_batch_id_fkey
      foreign key (batch_id) references batches(id) on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'test_attempts_student_id_fkey') then
    alter table test_attempts add constraint test_attempts_student_id_fkey
      foreign key (student_id) references profiles(id) on delete cascade not valid;
  end if;
end $$;
