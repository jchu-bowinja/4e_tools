# D&D 4e Builder Tools

Web-first suite of D&D 4th Edition tools built from data extracted from the legacy Character Builder. Static Vite + React app with hash-based navigation between tools.

For implemented features, ETL outputs, and smoke-test checklists, see [docs/roadmap.md](docs/roadmap.md).

## Prerequisites

- Node.js 18+ (Node 20 used by Netlify builds; see `netlify.toml`)
- Python 3.10+ (for ETL scripts and dev-server monster template paste parsing)

## Quick Start

1. Install dependencies: `npm install`
2. Build the rules index (required if `generated/rules_index.json` is missing):
   - `npm run etl:rules -- combined.dnd40.merged.xml generated`
   - `combined.dnd40.merged.xml` is gitignored; place your licensed extract at the repo root
3. (Optional) Build monster data:
   - From Adventure Tools install (Monster Builder):  
     `powershell -ExecutionPolicy Bypass -File tools/at-export-monsters.ps1`  
     (requires .NET Framework 4.x; copies encrypted data to `generated/at-cache`, exports `.monster` XML to `generated/at-monsters`, then runs the Python ETL)
   - Or from existing `.monster` / XML files:  
     `npm run etl:monsters -- <monster-folder-or-xml> generated`
   - then: `npm run etl:monsters:index-filters`
4. Run the app: `npm run dev` (typically `http://localhost:5173`)
5. Run tests: `npm test` (optional perf: `npm run test:perf`)

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server (`/api/reports`, `/api/parse-monster-template-paste`) |
| `npm run build` | Production build; copies `generated/` into `dist/generated/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Vitest suite |
| `npm run test:perf` | Performance tests under `tests/perf/` |
| `npm run etl:rules -- <input> generated` | Build `generated/rules_index.json` and catalogs |
| `npm run etl:monsters -- <input> generated` | Parse monster XML into JSON artifacts |
| `npm run etl:monsters:adventure-tools` | Export from Adventure Tools install, then run monster ETL |
| `npm run etl:monsters:index-filters` | Enrich monster index filter fields from entry files |
| `npm run etl:parse-template-paste --` | CLI for pasted monster template text |

## App Navigation

| Route | Tool |
| --- | --- |
| `#/builder` | Character Builder |
| `#/character-sheet` | Character Sheet |
| `#/monsters` | Monster browser, templates, encounter builder |
| `#/glossary` | Glossary Editor |
| `#/resource-editor` | Resource Editor |

## Hosting

Build with `npm run build` and publish `dist/` to any static host. Ensure ETL artifacts exist first (see Quick Start).

**Netlify Drop** — drag `dist/` onto [app.netlify.com/drop](https://app.netlify.com/drop). Feedback (`POST /api/reports`) will 404 without a serverless function.

**Netlify (Git + feedback)** — import from Git; `netlify.toml` sets build/publish and routes `/api/reports` to `netlify/functions/reports.ts`. Set env vars `GITHUB_REPO`, `GITHUB_TOKEN`, and optional `GITHUB_LABELS`. Issues are public on public repos; see [validatePayload.ts](src/features/reporting/validatePayload.ts) for payload limits. Local prod path: `netlify dev` with those env vars set.

**Vercel** — build command `npm run build`, output `dist`. Port `netlify/functions/reports.ts` to a Vercel API route to enable feedback.

## Documentation

- [docs/roadmap.md](docs/roadmap.md) — what's implemented, product vision, acceptance checklist
- [docs/class-build-options.md](docs/class-build-options.md) — PHB vs Essentials builds, class-feature grants, power swap/replace
- [docs/class-feature-priority-fix-report.md](docs/class-feature-priority-fix-report.md) — archived class-feature pass summary + audit commands
- [docs/special-cases-refactor-checklist.md](docs/special-cases-refactor-checklist.md) — hardcoded-rule refactor tracker
- [docs/equipment-system-design.md](docs/equipment-system-design.md) — equipment slot model (implemented)
- [docs/ui-bible.md](docs/ui-bible.md) — UI style guide
