-- ============================================================
-- BioMonk LMS — Migration 003
-- ============================================================
-- Add max_score to test_attempts so historical results remain
-- accurate even if question counts / marking schemes change.

alter table test_attempts
  add column if not exists max_score integer;

