# BioMonk LMS — Student Portal

A production-ready Learning Management System for BioMonk, a NEET Biology coaching platform by **Vicky Vaswani**.

---

## Setup

### 1. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     ← only needed for the extract script
```

### 2. Database

Run `supabase/migrations/001_initial.sql` in your Supabase project → **SQL Editor**.
Then run `supabase/migrations/002_patch.sql` as well.

### 3. Storage Bucket

In Supabase → Storage → **New Bucket**:
- Name: `study-material-bucket`
- Public: **OFF** (private)

This bucket holds all your PDFs (notes AND question papers).

---

## How to Add Study Materials (PDFs)

> Students go to `/materials` and see all uploaded PDFs. They can preview the full PDF in-browser and download it.

**Step 1** — Upload the PDF to Supabase Storage:
1. Open your Supabase project → Storage → `study-material-bucket`
2. Create a folder if you want (e.g. `cell-biology/`) — optional but organized
3. Upload the PDF file (drag from Google Drive on your desktop after downloading)
4. Note the file path shown (e.g. `cell-biology/chapter-notes.pdf`)

**Step 2** — Add the record to the database:
1. Table Editor → `study_materials` → **Insert row**
2. Fill in:
   | Column | Value |
   |--------|-------|
   | `chapter_id` | UUID of the chapter from the `chapters` table |
   | `title` | e.g. "Cell Biology — Chapter Notes" |
   | `type` | one of: `notes` `mindmap` `pyq` `formula_sheet` |
   | `file_path` | exact path from Step 1, e.g. `cell-biology/chapter-notes.pdf` |
   | `file_size_kb` | file size in KB (right-click file → Properties) |
   | `page_count` | number of pages in the PDF |

Students will see it immediately on refresh.

---

## How to Add Tests with Questions (from a PDF)

> Students go to `/tests`, take the test, and get scored automatically.

### Method A — Extract from a PDF on your computer

You have a PDF of questions (from Google Drive, downloaded to your PC).

**Step 1** — Create the test in Supabase:
1. Table Editor → `tests` → **Insert row**
2. Fill in:
   | Column | Value |
   |--------|-------|
   | `batch_id` | UUID of the batch |
   | `title` | "Cell Biology — Chapter Test 1" |
   | `type` | `chapter_test` / `full_mock` / `dpp` |
   | `chapter_id` | UUID of the chapter (optional) |
   | `duration_minutes` | e.g. `60` |
   | `total_marks` | e.g. `360` |
   | `marks_correct` | `4` |
   | `marks_wrong` | `-1` |
   | `is_active` | `false` (keep off until questions are ready) |
3. Copy the UUID of the just-created row.

**Step 2** — Run the extract script (open a new terminal):
```powershell
npx ts-node --project tsconfig.scripts.json scripts/extract-questions.ts `
  --file "C:\Users\priya\Downloads\cell-bio-questions.pdf" `
  --test-id YOUR-TEST-UUID-HERE
```

**Step 3** — Activate the test:
- Table Editor → `tests` → find your test → set `is_active = true`
- Students will now see the test in `/tests`

---

### Method B — Extract from a PDF already in Supabase Storage

If you uploaded your question PDF to the `study-material-bucket` bucket (or any bucket), run:

```powershell
npx ts-node --project tsconfig.scripts.json scripts/extract-questions.ts `
  --storage-path "study-material-bucket/test-questions/cell-bio-test.pdf" `
  --test-id YOUR-TEST-UUID-HERE
```

---

## PDF Format for Question Extraction

Your question PDF must follow this exact format:

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

- Questions are labelled Q1., Q2., Q3. etc.
- Options use A) B) C) D) or A. B. C. D. — both work
- Answer: must be a single letter A/B/C/D
- Explanation: is optional
- Leave a blank line between questions

---

## How to Enroll Students

1. Supabase → **Authentication → Users → Add user**
2. Enter their **email** and a temporary password
3. Check **"Email confirm": Skip** (or use `email_confirm: true` via CLI)
4. After they sign in, go to **Table Editor → profiles** and set:
   - `full_name` — student's name
   - `batch_id` — UUID of their batch

Or use the API: `POST /api/admin/create-student` with body:
```json
{ "email": "...", "full_name": "...", "batch_id": "...", "password": "..." }
```

---

## Setting Up Batches & Chapters

In Supabase Table Editor:

**batches** table:
```
name: "Champion's Batch 2026"
start_date: 2025-06-01
end_date: 2026-05-03
is_active: true
```

**chapters** table (or copy from NCERT syllabus below):
```
name: "The Living World"
class_level: XI
order_index: 1
batch_id: <your-batch-uuid>
is_locked: false
```

### Full NCERT Biology Syllabus (copy-paste into chapters table)

**Class XI (22 chapters):**
1. The Living World
2. Biological Classification
3. Plant Kingdom
4. Animal Kingdom
5. Morphology of Flowering Plants
6. Anatomy of Flowering Plants
7. Structural Organisation in Animals
8. Cell: The Unit of Life
9. Biomolecules
10. Cell Cycle and Cell Division
11. Transport in Plants
12. Mineral Nutrition
13. Photosynthesis in Higher Plants
14. Respiration in Plants
15. Plant Growth and Development
16. Digestion and Absorption
17. Breathing and Exchange of Gases
18. Body Fluids and Circulation
19. Excretory Products and their Elimination
20. Locomotion and Movement
21. Neural Control and Coordination
22. Chemical Coordination and Integration

**Class XII (14 chapters):**
1. Sexual Reproduction in Flowering Plants
2. Human Reproduction
3. Reproductive Health
4. Principles of Inheritance and Variation
5. Molecular Basis of Inheritance
6. Evolution
7. Human Health and Disease
8. Microbes in Human Welfare
9. Biotechnology: Principles and Processes
10. Biotechnology and its Applications
11. Organisms and Populations
12. Ecosystem
13. Biodiversity and Conservation
14. Environmental Issues

---

## Application Routes

| Route | What students see |
|-------|-------------------|
| `/login` | Login page |
| `/dashboard` | Overview: score, syllabus progress, schedule |
| `/materials` | Browse & view all PDFs with full in-browser viewer |
| `/tests` | List of all active tests for their batch |
| `/tests/[id]` | Take the test — timer, auto-save, mark for review |
| `/tests/[id]/result` | Score, chapter breakdown, question review |
| `/progress` | Score trend, test history |
| `/lectures` | Coming Soon |
| `/doubts` | Coming Soon |
| `/schedule` | Coming Soon |

## Deploy to Vercel

1. Push this folder to GitHub
2. Vercel → New Project → Import from GitHub
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — done
