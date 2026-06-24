# pbl-intelligence

**PBL Program Intelligence & Grant Reporting Assistant**
Full-stack MERN application built as part of the Mantra4Change Full-Stack Product Engineering Intern pre-interview take-home assignment.

---

## Quick Start (Local)

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally on `mongodb://localhost:27017` (or a MongoDB Atlas URI)

### 1. Clone & Navigate

```bash
cd pbl-intelligence
```

### 2. Backend Setup

```bash
cd server
cp .env.example .env          # edit MONGODB_URI if using Atlas
npm install
npm run seed                  # imports all CSVs into MongoDB
npm run dev                   # starts server on http://localhost:5000
```

### 3. Frontend Setup

```bash
cd client
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:5000
npm install
npm run dev                   # starts Vite dev server on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Architecture Overview

```
pbl-intelligence/
├── server/                     # Node.js + Express + Mongoose
│   ├── server.js               # Express app entry point
│   ├── data/raw/               # Raw CSV files + images (ground truth)
│   └── src/
│       ├── models/             # 4 Mongoose schemas (one per data grain)
│       ├── routes/             # REST route handlers
│       ├── services/
│       │   ├── riskEngine.js       # Pure functions — school + geography risk
│       │   └── narrativeGenerator.js  # Template narrative generator
│       └── scripts/
│           └── seedData.js     # CSV → MongoDB ingestion
└── client/                     # React + Vite
    └── src/
        ├── api/                # Thin fetch wrappers
        ├── components/         # Shared UI primitives
        └── pages/
            ├── Dashboard.jsx   # Filters + KPIs + table + Tier 2
            └── GrantReport.jsx # Grant selector + facts + gallery + narrative
```

**Data flow:**
```
Raw CSVs → seedData.js → MongoDB collections
                               ↓
                  Express routes (aggregation pipelines)
                               ↓
                       REST API (JSON)
                               ↓
                     React frontend (display only)
```

The frontend **never computes statistics from raw rows** — it only renders numbers the backend has already aggregated.

---

## Data Model

### `schoolresponses` Collection
One document per teacher-school-month row (~6,900 total across 3 months).

Key fields:
- `reportingMonth` / `district` / `block` — indexed for fast filtered queries
- `grades: ["6","7","8"]` — parsed array (was `"Classes 6, 7 and 8"` in CSV)
- `subjects: ["Math","Science"]` — parsed array (was `"Math and Science"` in CSV)
- `conducted: Boolean` — whether PBL ran this month
- `attendanceRate: Float` — 0.0–1.0, from CSV `Derived: Overall PBL attendance rate`
- `riskStatus: String` — from CSV `Derived: Risk status`

### `grantfinances` Collection
One document per grant × month × budget line (45 total).

### `grantperformances` Collection
One document per grant × month (9 total — 3 grants × 3 months).

> **Important:** `draft_report_text` from the source CSV is **deliberately excluded** from this schema. It is a human-written reference — displaying it would misrepresent it as app output. The app's narrative generator produces independent text.

### `evidencerecords` Collection
One document per media asset (9 total). `relativePath` is served as a static file from `server/data/raw/images/`.

---

## Risk Logic

### School-Level (Exact Thresholds — Verified Against All 6,900 Rows)

| Attendance Rate | Risk Status |
|---|---|
| ≥ 75% | On Track |
| 60–75% | Behind |
| 35–60% | At Risk |
| < 35% | Critical |

The seed script cross-checks every row against these thresholds vs. the CSV's `Derived: Risk status` column. **Result: 0 mismatches across 6,900 rows.**

Schools that did not conduct PBL (`conducted = No`) have `totalAttendance = 0` and a real enrollment value, yielding an attendance rate of 0% → automatically **Critical** by the formula.

### Geography-Level Aggregation (Documented Design Decision)

**Chosen rule:** Compute the average attendance rate across *participating* (conducted=Yes) schools in the geography, then apply the same four-band thresholds to that average.

**Why this rule:**
- A single numeric average is more comparable across geographies of different sizes than the mode of risk bands.
- It's directly explainable: *"District X is At Risk because the average attendance across its 42 participating schools is 51%, which falls in the 35–60% band."*
- It's coherent with the school-level formula — same thresholds, same units.

**Non-participating schools** are explicitly excluded from the geography attendance average because their zero-attendance is a *participation* failure, not an *engagement* failure. Both signals are exposed separately in the API response (`participationRate` and `avgAttendanceRate`), and both are visible in the dashboard as distinct KPI cards.

This is a **designed judgment call** — not a fact given by the assignment. The alternative (mode of school-level risk bands) is documented in `server/src/services/riskEngine.js` as a rejected option with rationale.

---

## AI / Narrative Generation

### Architecture

```
structured facts object (already-computed numbers)
         ↓
generateGrantNarrative(facts) or generateProgramNarrative(facts)
         ↓
paragraph string
```

The generator function receives **only the facts object** — no raw rows, no database calls inside the function body. Every sentence in the output is traceable to a named field in the facts object (see comments in `narrativeGenerator.js`).

### Upgrade Path to Real LLM

Swapping the template engine for a real Claude/OpenAI call requires **changing only the function body** of `generateGrantNarrative()` and `generateProgramNarrative()` in `server/src/services/narrativeGenerator.js`. The function signatures, facts object shapes, route handlers, and all frontend call sites remain unchanged.

### `AI_ENABLED` Flag

Set `AI_ENABLED=false` in `server/.env` (or the hosting environment) to disable narrative generation entirely. The API still returns the complete structured facts object with `{ narrative: null, aiEnabled: false }`. The frontend renders a "Facts Only Mode" message instead of the narrative paragraph — proving the deterministic layer works independently of the narrative layer.

---

## Why MongoDB (vs. PostgreSQL)

**For this use case, MongoDB is a natural fit:**
- Each school-response row is a self-contained document with no referential integrity constraints needed at query time.
- The aggregation needs (sum/avg/count by month+district+block) map cleanly to MongoDB's `$group` pipeline.
- The schema per row is uniform but the embedded arrays (grades, subjects) would require a junction table in Postgres.

**Where Postgres would be better:**
- The grant data has clean relational structure (grant → finance lines, grant → performance → evidence). This is a candidate for proper FK relationships and `JOIN` queries.
- If the data grew to millions of rows with complex multi-table reporting, Postgres's query planner would outperform MongoDB's aggregation pipeline.

This trade-off is noted as a future improvement: migrate grant-related collections to a relational store while keeping school-response documents in MongoDB.

---

## Assumptions Made on Ambiguous Data

1. **Non-conducted schools in risk distribution:** Schools that did not run a PBL session (`conducted=No`) have `attendanceRate=0`, which classifies them as "Critical" by the formula. This is correct per the formula but creates a potentially misleading headline number. The dashboard surfaces both "non-participant count" and "attendance rate among participants" as separate cards, and the README (this document) flags the modeling decision explicitly.

2. **Grade parsing:** Regex extracts all digit sequences from the grade field. Works for `"Class 6"`, `"Classes 6, 7 and 8"`, `"Classes 7 and 8"`. Fails for unusual patterns like `"Grade 6"` — none observed in the data.

3. **Subject parsing:** Case-insensitive match against the known set `["Math","Science"]`. Works for `"Math and Science"`, `"Math"`, `"Science"`. A new subject would need to be added to `KNOWN_SUBJECTS` in `seedData.js`.

4. **Evidence rate denominator:** Evidence rate = evidence-submitted schools / PBL-conducted schools. Schools that didn't run a session are excluded because evidence submission is meaningless for a non-session.

5. **Geography-level risk aggregation:** See "Geography-Level Aggregation" section above.

6. **`draft_report_text` exclusion:** The reference narrative text from `02_Grant_Performance_and_Report_Material.csv` is intentionally not stored or displayed. The template engine was designed to produce similarly-grounded but independently-authored output.

---

## Known Limitations

- **Static data only:** Data is seeded from CSVs at startup. There is no upload/live ingestion UI.
- **No authentication:** All data is accessible to any client. This is intentional per the assignment scope.
- **Images are synthetic:** All photos and news clippings are AI-generated synthetic assets, not real field photographs.
- **Geography-level risk is an average, not a weighted one:** Schools in the same geography are treated equally regardless of their enrollment size. A school with 300 students is weighted the same as one with 50.

---

## Future Improvements

1. **Weighted geography-level risk:** Weight each school's attendance rate by its enrollment size, so larger schools have proportionally more influence on the geography average.

2. **Relational store for grant data:** Migrate `GrantFinance`, `GrantPerformance`, and `EvidenceRecord` to PostgreSQL for proper FK enforcement and join-based reporting. Keep `SchoolResponse` in MongoDB.

3. **Real-time ingestion + upload UI:** Allow program managers to upload new monthly CSV files via a drag-and-drop interface, with the backend validating headers and running the seed logic incrementally.

4. **LLM upgrade path (already designed):** Replace `generateGrantNarrative()` and `generateProgramNarrative()` bodies with an async call to Claude or GPT-4, passing the facts object as a structured prompt. No other code changes needed.

5. **Recommended Actions list (Tier 3):** Auto-generate one action row per Critical geography using the risk engine output, with owner/due date/linked metric fields.

---

## Deployment

### Backend (Render)
- Environment: Node web service
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `MONGODB_URI`, `PORT`, `AI_ENABLED`

### Frontend (Vercel)
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL` (pointing to Render backend URL)

---

*All data in this project is synthetic. No real school, district, donor, or student data is represented.*
