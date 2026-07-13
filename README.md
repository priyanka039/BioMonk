# BioMonk LMS

A production-ready Learning Management System for **BioMonk** — NEET Biology coaching by **Vicky Vaswani**.

- **Students:** study materials, timed tests, progress, error book, batch announcements
- **Coach:** password-protected admin panel at `/admin` (no Supabase dashboard needed for day-to-day work)

---

## Quick start (local)

```powershell
# 1. Copy env template and fill in values
copy .env.local.example .env.local

# 2. Install & run
npm install
node .\node_modules\next\dist\bin\next dev --webpack

# 3. Open http://localhost:3000
```

---

## Environment variables

All **7** are required for production (admin panel + backups + storage):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client / student auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin actions, backups, storage |
| `ADMIN_EMAIL` | Seeds the **first** admin only (see note below) |
| `ADMIN_PASSWORD` | Seeds the **first** admin only |
| `ADMIN_SESSION_SECRET` | Signs the admin session cookie (long random hex) |
| `CRON_SECRET` | Protects `/api/cron/backup` |

Generate secrets (PowerShell):

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

**Important — admin login uses the database, not env vars every time.**

`ADMIN_EMAIL` / `ADMIN_PASSWORD` only create the first row in `admin_users` when that table is empty. After that, login and password changes are stored in Supabase. Changing Vercel env vars does **not** change the live admin email or password.

To check the current admin:

```sql
select email, created_at, last_login_at from admin_users;
```

To switch email: update the row in SQL, or delete the row and log in again (bootstrap recreates from env).

---

## Database migrations

Run in **Supabase → SQL Editor**, in order:

| # | File | What it adds |
|---|------|----------------|
| 1 | `001_initial.sql` | Core tables, RLS, auth trigger |
| 2 | `002_patch.sql` | `created_at` patches |
| 3 | `003_add_max_score_to_test_attempts.sql` | Historical score accuracy |
| 4 | `004_error_book.sql` | Error book + auto-sync on test submit |
| 5 | `005_admin_panel.sql` | Admin users, audit logs, soft deletes, test versions |
| 6 | `006_repair_dropped_tables.sql` | Repair only if 005 failed / tables missing |
| 7 | `007_batch_control.sql` | Announcements, read tracking, batch test guard |

**Verify all migrations ran:**

```sql
select '001' as m, case when exists (select 1 from information_schema.tables where table_name = 'batches') then 'ok' else 'missing' end
union all select '004', case when exists (select 1 from information_schema.tables where table_name = 'error_book_entries') then 'ok' else 'missing' end
union all select '005', case when exists (select 1 from information_schema.tables where table_name = 'admin_users') then 'ok' else 'missing' end
union all select '007', case when exists (select 1 from information_schema.tables where table_name = 'announcements') then 'ok' else 'missing' end;
```

---

## Storage

Supabase → Storage → **New bucket**

- Name: `study-material-bucket`
- Public: **OFF** (private)

Used for study PDFs and weekly JSON backups.

---

## Deploy to Vercel

1. Push `main` to GitHub (`priyanka039/BioMonk`)
2. [Vercel](https://vercel.com) → import the repo (or redeploy existing project)
3. **Settings → Environment Variables** — add all 7 vars above (Production + Preview)
4. Deploy

`vercel.json` configures a weekly backup cron (Mondays 03:00 UTC) → `/api/cron/backup`.

**After deploy, smoke test:**

```powershell
Invoke-RestMethod https://YOUR-APP.vercel.app/api/health
# Expect: status ok, db true, storage true
```

Then: `/admin` (coach login) and `/login` (student login).

---

## Coach workflow (admin panel)

Log in at **`/admin`**. Recommended setup order:

1. **Batches** — create e.g. `NEET 2027`, set `end_date` (May 2, 2027) for student exam countdown
2. **Chapters** — add syllabus per batch; **lock** chapters not yet released
3. **Students** — create accounts (email + temp password + batch)
4. **Materials** — upload PDFs (notes, mindmaps, PYQs, formula sheets)
5. **Tests** — create test, upload question PDF, run extraction, activate
6. **Announcements** — batch-wide or per-batch; high priority shows as dashboard banner
7. **Settings** — change admin password (updates DB; no redeploy needed)

### Admin routes

| Route | Purpose |
|-------|---------|
| `/admin` | Coach login |
| `/admin/materials` | Upload / archive study PDFs |
| `/admin/tests` | Create tests, extract questions from PDF |
| `/admin/students` | Enroll students, reset passwords |
| `/admin/batches` | Manage batches + batch dashboard |
| `/admin/chapters` | Chapters per batch, lock/unlock |
| `/admin/announcements` | In-app notifications |
| `/admin/activity` | Audit log |
| `/admin/archive` | Soft-deleted materials, tests, students |
| `/admin/settings` | Change password, system health |

---

## Student routes

| Route | Status |
|-------|--------|
| `/login` | Student sign-in |
| `/dashboard` | Progress summary, exam countdown, announcements |
| `/materials` | PDF viewer (locked chapters hidden) |
| `/tests` | Active tests for student's batch |
| `/tests/[id]` | Timed test — auto-save, mark for review |
| `/tests/[id]/result` | Score, analysis, printable report |
| `/progress` | Score trends, test history |
| `/error-book` | Wrong answers auto-captured from tests |
| `/lectures` | Coming soon |
| `/doubts` | Coming soon |
| `/schedule` | Coming soon |

---

## Adding tests (PDF format)

Create the test in **Admin → Tests**, then upload a question PDF. The admin UI runs extraction automatically. You can also use the CLI:

```powershell
node .\node_modules\ts-node\dist\bin.js --project tsconfig.scripts.json scripts/extract-questions.ts `
  --file "C:\path\to\questions.pdf" `
  --test-id YOUR-TEST-UUID
```

**Required PDF format:**

```
Q1. What is the powerhouse of the cell?
A) Nucleus
B) Mitochondria
C) Ribosome
D) Golgi body
Answer: B
Explanation: Mitochondria produce ATP via cellular respiration.

Q2. Which base pairs with Adenine in DNA?
A) Guanine
B) Cytosine
C) Thymine
D) Uracil
Answer: C
```

- Labels: `Q1.`, `Q2.`, …
- Options: `A)` / `A.` style
- `Answer:` single letter A–D
- `Explanation:` optional; blank line between questions

---

## NCERT Biology syllabus (reference)

Use **Admin → Chapters** to add these, or paste into Supabase if needed.

**Class XI (22):** The Living World, Biological Classification, Plant Kingdom, Animal Kingdom, Morphology of Flowering Plants, Anatomy of Flowering Plants, Structural Organisation in Animals, Cell: The Unit of Life, Biomolecules, Cell Cycle and Cell Division, Transport in Plants, Mineral Nutrition, Photosynthesis in Higher Plants, Respiration in Plants, Plant Growth and Development, Digestion and Absorption, Breathing and Exchange of Gases, Body Fluids and Circulation, Excretory Products and their Elimination, Locomotion and Movement, Neural Control and Coordination, Chemical Coordination and Integration

**Class XII (14):** Sexual Reproduction in Flowering Plants, Human Reproduction, Reproductive Health, Principles of Inheritance and Variation, Molecular Basis of Inheritance, Evolution, Human Health and Disease, Microbes in Human Welfare, Biotechnology: Principles and Processes, Biotechnology and its Applications, Organisms and Populations, Ecosystem, Biodiversity and Conservation, Environmental Issues

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build |
| `npm test` | Run Vitest (19 tests) |
| `npm run extract-questions` | CLI question extraction from PDF |
| `npm run extract-questions-docx` | Extract from Word doc |
| `npm run restore-backup` | Restore from Supabase storage backup |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Admin login ignores new Vercel email/password | Login uses `admin_users` table — update via SQL or Settings |
| `coach@…` works but `mentor@…` doesn't | `update admin_users set email = 'mentor@…'` or delete row and re-bootstrap |
| Health check `storage: false` | Create `study-material-bucket` (private) |
| Health check `db: false` | Check Supabase keys; run migration 005 |
| Announcements / bell not working | Run migration `007_batch_control.sql` |
| Student signup "Database error" | Run `006_repair_dropped_tables.sql` (fixes `handle_new_user` trigger) |

---

## Stack

Next.js 16 · React 19 · Supabase (Auth, Postgres, Storage) · TypeScript · Vitest
