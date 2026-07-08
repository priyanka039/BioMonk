-- ============================================================
-- BioMonk LMS — Migration 007: Batch control + announcements
-- Run AFTER 001–006. Idempotent + additive only.
-- ============================================================

-- ─── Announcements (in-app notifications) ────────────────────
create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  batch_id    uuid references batches(id) on delete cascade,  -- NULL = all batches
  priority    text not null default 'normal'
                check (priority in ('normal', 'high')),
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_announcements_batch on announcements(batch_id);
create index if not exists idx_announcements_live on announcements(starts_at, expires_at)
  where deleted_at is null;

-- ─── Read tracking ───────────────────────────────────────────
create table if not exists announcement_reads (
  student_id      uuid not null references profiles(id) on delete cascade,
  announcement_id uuid not null references announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (student_id, announcement_id)
);

create index if not exists idx_announcement_reads_student on announcement_reads(student_id);

-- ─── RLS ─────────────────────────────────────────────────────
alter table announcements     enable row level security;
alter table announcement_reads enable row level security;

drop policy if exists "Students read live announcements" on announcements;
create policy "Students read live announcements"
  on announcements for select
  to authenticated
  using (
    deleted_at is null
    and starts_at <= now()
    and (expires_at is null or expires_at > now())
    and (batch_id is null or batch_id = get_my_batch_id())
  );

drop policy if exists "Students mark announcements read" on announcement_reads;
create policy "Students mark announcements read"
  on announcement_reads for insert
  to authenticated
  with check (student_id = auth.uid());

drop policy if exists "Students read own announcement reads" on announcement_reads;
create policy "Students read own announcement reads"
  on announcement_reads for select
  to authenticated
  using (student_id = auth.uid());

-- ─── Tighten test_attempts INSERT (batch guard) ──────────────
drop policy if exists "Students insert own attempts" on test_attempts;
create policy "Students insert own attempts"
  on test_attempts for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and test_id in (
      select id from tests where batch_id = get_my_batch_id()
    )
  );
