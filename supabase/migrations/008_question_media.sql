-- ============================================================
-- BioMonk LMS — Migration 008: Question media (diagrams/images)
-- Run AFTER 001–007. Idempotent + additive only.
-- ============================================================

alter table questions add column if not exists question_image_path text;
alter table questions add column if not exists option_a_image_path text;
alter table questions add column if not exists option_b_image_path text;
alter table questions add column if not exists option_c_image_path text;
alter table questions add column if not exists option_d_image_path text;

comment on column questions.question_image_path is 'Private storage path for stem diagram/screenshot';
comment on column questions.option_a_image_path is 'Private storage path for option A image';
comment on column questions.option_b_image_path is 'Private storage path for option B image';
comment on column questions.option_c_image_path is 'Private storage path for option C image';
comment on column questions.option_d_image_path is 'Private storage path for option D image';
