# D&D 4e Web Builder (MVP)

Web-first, guided D&D 4e character builder using data extracted from the legacy Character Builder.

## What Is Implemented

- ETL pipeline that normalizes source rules into `generated/rules_index.json`
- ETL anomaly log at `generated/etl_anomalies.jsonl` for parser improvement loops
- Rules modules for:
  - prerequisite validation
  - class + hybrid class skill and power-slot legality validation
  - armor/shield proficiency legality checks
  - feat legality filtering
  - derived stat calculations including class/hybrid defenses and armor/shield AC bonuses
  - race/subrace granted powers and stale power-selection pruning
  - weapon + implement attack preview calculations
- React + TypeScript web UI with:
  - race/class and hybrid class selection
  - ability score editing
  - class skill training selection and live skill sheet modifiers
  - legal feat filtering
  - class power selection with level-1 at-will/encounter/daily slot limits
  - armor and shield selection
  - weapon + implement equipment and attack previews
  - live character sheet
  - local persistence (`localStorage`)
  - JSON import/export
  - In-app **Feedback** modal (feedback / bug report) that posts to `POST /api/reports`.
    - In `npm run dev`, reports append to `received_reports/reports.jsonl` (gitignored).
    - In Netlify production, `netlify.toml` redirects `/api/reports` to a serverless function (`netlify/functions/reports.ts`) that opens a GitHub issue. See [Hosting on Netlify (with feedback)](#hosting-on-netlify-with-feedback) for setup.
- Test coverage for ETL artifact presence and rules core behavior

## Prerequisites

- Node.js 18+ (for Vite + React tooling)
- Python 3.10+ (for ETL scripts)

## Quick Start

1. Install dependencies:
   - `npm install`
2. Build the rules index (required before running the app):
   - from Character Builder XML: `npm run etl:rules -- combined.dnd40.merged.xml generated`
3. (Optional) Build the monster index:
   - `npm run etl:monsters -- <selected-monster-folder-or-xml-file> generated`
   - example: `npm run etl:monsters -- MonsterFiles/01 generated`
   - example: `npm run etl:monsters -- combined.monsters.xml generated`
   - output:
     - `generated/monsters/index.json` (lightweight list + summary fields)
     - `generated/monsters/entries/*.json` (one structured parsed monster per file)
4. Run the app:
   - `npm run dev`
5. Run tests:
   - `npm test`

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - build production assets and include `generated/` JSON data in `dist/generated/`
- `npm run preview` - preview production build locally
- `npm test` - run Vitest test suite once
- `npm run etl:rules -- <input-json-or-xml> generated` - build `generated/rules_index.json`
- `npm run etl:monsters -- <input-folder-or-xml-file> generated` - parse monster XML and emit structured JSON artifacts

## Hosting (Share With Others)

This app is a static Vite site. A deployable build is created in `dist/`.

1. Ensure data artifacts exist:
   - `npm run etl:rules -- combined.dnd40.merged.xml generated`
   - optional monster data: `npm run etl:monsters -- <selected-monster-folder-or-xml-file> generated`
2. Build:
   - `npm run build`
3. Publish the `dist/` folder with any static host.

### Fastest Option: Netlify Drop (No Git Setup)

1. Open [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the local `dist/` folder onto the page
3. Netlify gives you a public URL immediately

Note: a Drop deploy ships only the static `dist/` folder, so the in-app
**Feedback** modal will get a 404 from `POST /api/reports`. To receive feedback in
production, deploy from Git instead — see the next section.

### Hosting on Netlify (with feedback)

Deploy from Git so Netlify also builds the serverless function in `netlify/functions/`,
which receives `POST /api/reports` and creates a GitHub issue for each submission.

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import from Git**, select the repo. Netlify reads
   `netlify.toml`, so build command (`npm run build`), publish dir (`dist`), and the
   `/api/reports → /.netlify/functions/reports` redirect are auto-configured.
3. Create a GitHub fine-grained Personal Access Token:
   - **Repository access:** only the repo that should receive issues.
   - **Repository permissions → Issues:** `Read and write`.
4. In **Site configuration → Environment variables**, add:
   - `GITHUB_REPO` — `owner/repo` (the same repo you scoped the PAT to)
   - `GITHUB_TOKEN` — the PAT value
   - `GITHUB_LABELS` (optional) — comma-separated **extra** labels beyond the submitter’s
     type (`bug`, `enhancement`, `documentation`, `question`). Each name must already exist
     on the repo or GitHub will reject the request with 422.
5. Trigger a deploy. Submitting feedback on the live site will open a new GitHub issue
   and the modal will show its reference (e.g. `#42`).

Caveats:
- Issues created by the function are **public** if the target repo is public. The body
  contains the user-supplied title/description plus the reporting browser's User-Agent,
  app version, and current route. Don't point this at a sensitive repo.
- The function only fires on `POST /api/reports` and validates with the same parser the
  dev server uses (`src/features/reporting/validatePayload.ts`), so payload shape and
  size limits are identical between dev and prod.
- To exercise the production path locally, install the Netlify CLI and run
  `netlify dev` with `GITHUB_REPO`/`GITHUB_TOKEN` exported in your shell.

### Git-Based Option: Vercel

1. Push this repo to GitHub
2. Import the repo in Vercel
3. Build command: `npm run build`
4. Output directory: `dist`

Note: the `/api/reports` receiver in this repo is implemented as a **Netlify** Function.
On Vercel you'd need to port `netlify/functions/reports.ts` to a Vercel API Route under
`api/reports.ts` (the validation logic in `src/features/reporting/validatePayload.ts`
is host-agnostic and can be reused as-is).

After deploy, share the generated URL with others.

## Key Folders

- `tools/etl/` - normalization and indexing pipeline
- `src/rules/` - typed models, prerequisite evaluator, stat calculator, option resolver
- `src/features/builder/` - builder state, persistence, UI flow
- `tests/` - ETL and rules tests
- `generated/` - generated rules and ETL artifacts

## UI Guidelines

- `docs/ui-bible.md` - project UI style and design bible for consistency, reuse, and UI review passes.

## Acceptance Checklist

- Build a new level-1 hybrid character and verify legal hybrid power slots are enforced.
- Pick a race/subrace power option, then switch subrace and confirm stale power selections are removed.
- Add a feat that grants a power and confirm the power appears in character power selections.
- Equip a weapon and implement and verify the attack preview updates (including nonproficient penalty behavior).
- Export and re-import the character JSON and confirm powers/selections/derived stats remain consistent.

