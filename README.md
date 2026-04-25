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

### Git-Based Option: Vercel

1. Push this repo to GitHub
2. Import the repo in Vercel
3. Build command: `npm run build`
4. Output directory: `dist`

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

