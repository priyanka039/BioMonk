-- ============================================================
-- BioMonk LMS — Migration Patch 002
-- Run AFTER 001_initial.sql if you already ran it.
-- If starting fresh, you can add these to 001_initial.sql directly.
-- ============================================================

-- Add created_at to batches (if not exists)
alter table batches add column if not exists created_at timestamptz not null default now();

-- Add created_at to tests (if not exists)
alter table tests add column if not exists created_at timestamptz not null default now();

-- ─── Storage: Allow authenticated users to upload (for admin panel) ───────────
-- The service role bypasses RLS automatically, but if using anon client for uploads:
create policy "Authenticated users can upload study materials"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'study-material-bucket');

create policy "Authenticated users can delete study materials"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'study-material-bucket');

-- ─── Allow students to write study_materials (needed for admin who is also a student user)
-- Actually we handle this via supabase-admin (service role), so no student-level write policies needed.

-- ─── Fix: Allow INSERT on profiles for service role (via trigger) ─────────────
-- The handle_new_user trigger runs as security definer, so it works regardless of RLS.
-- But if manually inserting profiles as admin, we need:
create policy "Service role can manage profiles"
  on profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ─── Allow admin to manage chapters, materials, tests via client ───────────────
-- Admin panel uses service role client, so RLS is bypassed automatically.
-- No additional policies needed for admin writes.
