-- ============================================================
-- BioMonk LMS — Supabase Database Migration
-- Run this in the Supabase SQL editor to set up all tables.
-- ============================================================

-- Enable UUID generation
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

-- ─── profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  batch_id    uuid references batches(id),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ─── chapters ────────────────────────────────────────────────
create table if not exists chapters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  class_level text not null check (class_level in ('XI', 'XII')),
  order_index integer not null default 0,
  batch_id    uuid references batches(id) on delete cascade,
  is_locked   boolean not null default false
);

-- ─── study_materials ─────────────────────────────────────────
create table if not exists study_materials (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid references chapters(id) on delete set null,
  title        text not null,
  type         text not null check (type in ('notes', 'mindmap', 'pyq', 'formula_sheet')),
  file_path    text not null,
  file_size_kb integer not null default 0,
  page_count   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── tests ───────────────────────────────────────────────────
create table if not exists tests (
  id               uuid primary key default gen_random_uuid(),
  chapter_id       uuid references chapters(id),
  title            text not null,
  type             text not null check (type in ('chapter_test', 'full_mock', 'dpp')),
  duration_minutes integer not null default 60,
  total_marks      integer not null default 360,
  marks_correct    integer not null default 4,
  marks_wrong      integer not null default -1,
  is_active        boolean not null default false,
  scheduled_at     timestamptz,
  batch_id         uuid not null references batches(id) on delete cascade
);

-- ─── questions ───────────────────────────────────────────────
create table if not exists questions (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null references tests(id) on delete cascade,
  question_text  text not null,
  option_a       text not null,
  option_b       text not null,
  option_c       text not null,
  option_d       text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation    text,
  order_index    integer not null default 0
);

-- ─── test_attempts ───────────────────────────────────────────
create table if not exists test_attempts (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id) on delete cascade,
  test_id      uuid not null references tests(id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        integer,
  is_completed boolean not null default false
);

-- ─── test_responses ──────────────────────────────────────────
create table if not exists test_responses (
  id                   uuid primary key default gen_random_uuid(),
  attempt_id           uuid not null references test_attempts(id) on delete cascade,
  question_id          uuid not null references questions(id) on delete cascade,
  selected_option      text check (selected_option in ('A', 'B', 'C', 'D')),
  is_marked_for_review boolean not null default false,
  time_spent_seconds   integer not null default 0,
  unique(attempt_id, question_id)
);

-- ─── waitlist (for coming-soon notifications) ─────────────────
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table batches          enable row level security;
alter table profiles         enable row level security;
alter table chapters         enable row level security;
alter table study_materials  enable row level security;
alter table tests            enable row level security;
alter table questions        enable row level security;
alter table test_attempts    enable row level security;
alter table test_responses   enable row level security;
alter table waitlist         enable row level security;

-- ─── Helper function ─────────────────────────────────────────

create or replace function get_my_batch_id()
returns uuid language sql security definer as $$
  select batch_id from profiles where id = auth.uid()
$$;

-- ─── batches: students can only see their own batch ──────────
create policy "Students see own batch"
  on batches for select
  using (id = get_my_batch_id());

-- ─── profiles: students can only read their own profile ──────
create policy "Students read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Students update own profile"
  on profiles for update
  using (id = auth.uid());

-- Auto-create profile on auth.users insert (trigger)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── chapters: students see chapters in their batch ──────────
create policy "Students see own batch chapters"
  on chapters for select
  using (batch_id = get_my_batch_id());

-- ─── study_materials: students see materials for their batch chapters ──
create policy "Students see own batch materials"
  on study_materials for select
  using (
    chapter_id in (
      select id from chapters where batch_id = get_my_batch_id()
    )
  );

-- ─── tests: students see tests for their batch ───────────────
create policy "Students see own batch tests"
  on tests for select
  using (batch_id = get_my_batch_id());

-- ─── questions: students see questions for their batch's tests ──
create policy "Students see questions for their tests"
  on questions for select
  using (
    test_id in (
      select id from tests where batch_id = get_my_batch_id()
    )
  );

-- ─── test_attempts ───────────────────────────────────────────
create policy "Students read own attempts"
  on test_attempts for select
  using (student_id = auth.uid());

create policy "Students insert own attempts"
  on test_attempts for insert
  with check (student_id = auth.uid());

create policy "Students update own attempts"
  on test_attempts for update
  using (student_id = auth.uid());

-- ─── test_responses ──────────────────────────────────────────
create policy "Students read own responses"
  on test_responses for select
  using (
    attempt_id in (
      select id from test_attempts where student_id = auth.uid()
    )
  );

create policy "Students insert own responses"
  on test_responses for insert
  with check (
    attempt_id in (
      select id from test_attempts where student_id = auth.uid()
    )
  );

create policy "Students update own responses"
  on test_responses for update
  using (
    attempt_id in (
      select id from test_attempts where student_id = auth.uid()
    )
  );

-- ─── waitlist: anyone (anon) can insert, no reads ────────────
create policy "Anyone can join waitlist"
  on waitlist for insert
  with check (true);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Run these in the Supabase Storage UI or via CLI:
--
-- 1. Create bucket: "study-material-bucket" (private, not public)
-- 2. Grant authenticated users ability to read:

insert into storage.buckets (id, name, public)
values ('study-material-bucket', 'study-material-bucket', false)
on conflict (id) do nothing;

create policy "Authenticated users can read study materials"
  on storage.objects for select
  using (
    bucket_id = 'study-material-bucket'
    and auth.role() = 'authenticated'
  );

-- Admin can manage all objects via service role (no policy needed)
