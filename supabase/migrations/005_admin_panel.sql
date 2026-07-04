-- ============================================================
-- BioMonk LMS — Migration 005: Admin Panel
-- Run AFTER 001–004. Idempotent + additive only (no drops of data).
-- Adds: admin_users, soft-delete columns, cheap metadata + updated_at
--       trigger, test extraction lock, material integrity, test_versions,
--       audit_logs, FK indexes, CHECK constraints.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── admin_users (single-admin, DB-backed auth) ──────────────
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,        -- scrypt: salt:hash hex (Node crypto, no bcrypt dep)
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- ─── Soft deletes ────────────────────────────────────────────
alter table study_materials add column if not exists deleted_at timestamptz;
alter table tests           add column if not exists deleted_at timestamptz;
alter table profiles        add column if not exists deleted_at timestamptz;

-- ─── Test columns + extraction lock ──────────────────────────
alter table tests add column if not exists subject text;
alter table tests add column if not exists original_file_path text;
alter table tests add column if not exists extracting_at timestamptz;   -- concurrency lock

-- subject CHECK (guard against duplicate constraint on re-run)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tests_subject_check'
  ) then
    alter table tests add constraint tests_subject_check
      check (subject is null or subject in ('biology','chemistry','physics'));
  end if;
end $$;

-- ─── Material integrity + original filename ──────────────────
alter table study_materials add column if not exists file_hash text;          -- SHA-256, dup detection
alter table study_materials add column if not exists original_filename text;  -- real name (we store UUID paths)

-- ─── Cheap metadata (cheap now, invaluable later) ────────────
alter table study_materials add column if not exists created_by text;
alter table study_materials add column if not exists updated_at timestamptz not null default now();
alter table tests           add column if not exists created_by text;
alter table tests           add column if not exists updated_at timestamptz not null default now();
alter table profiles        add column if not exists created_by text;
alter table profiles        add column if not exists updated_at timestamptz not null default now();

-- One reusable trigger so updated_at can never be forgotten in app code
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_materials_updated_at on study_materials;
create trigger trg_materials_updated_at before update on study_materials
  for each row execute function set_updated_at();

drop trigger if exists trg_tests_updated_at on tests;
create trigger trg_tests_updated_at before update on tests
  for each row execute function set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ─── Test versioning (+ hash + raw output for later debugging) ─
create table if not exists test_versions (
  id                uuid primary key default gen_random_uuid(),
  test_id           uuid not null references tests(id) on delete cascade,
  version_number    integer not null,
  pdf_path          text not null,
  pdf_hash          text,
  question_count    integer not null default 0,
  extraction_report jsonb,          -- { format, extracted, failed[], unmatched[], durationMs, rawOutput }
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  unique(test_id, version_number)
);

alter table questions     add column if not exists test_version_id uuid references test_versions(id);
alter table test_attempts add column if not exists test_version_id uuid references test_versions(id);

-- ─── Audit log (before/after in metadata) — powers Activity feed ─
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,        -- create|update|archive|restore|activate|deactivate|extract|login|backup
  table_name  text not null,
  record_id   text,
  admin_email text not null,
  metadata    jsonb,                -- { before, after, durationMs, ... }
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);

-- ─── Basic FK indexes ────────────────────────────────────────
create index if not exists idx_test_attempts_student_id on test_attempts(student_id);
create index if not exists idx_test_attempts_test_id    on test_attempts(test_id);
create index if not exists idx_questions_test_id        on questions(test_id);
create index if not exists idx_materials_chapter_id     on study_materials(chapter_id);
create index if not exists idx_profiles_batch_id        on profiles(batch_id);

-- ─── CHECK constraints (guard against duplicates on re-run) ───
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tests_duration_positive'
  ) then
    alter table tests add constraint tests_duration_positive check (duration_minutes > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'tests_total_marks_positive'
  ) then
    alter table tests add constraint tests_total_marks_positive check (total_marks > 0);
  end if;
end $$;

-- ─── RLS: allow service role full access to new tables ───────
-- (Service role bypasses RLS, but enable RLS so anon/authenticated can't read.)
alter table admin_users   enable row level security;
alter table audit_logs    enable row level security;
alter table test_versions enable row level security;

-- test_versions: students may need to read the current version for their attempts
drop policy if exists "Anyone authenticated can read test_versions" on test_versions;
create policy "Anyone authenticated can read test_versions"
  on test_versions for select
  to authenticated
  using (true);

-- admin_users + audit_logs: no anon/authenticated policies → only service role.
