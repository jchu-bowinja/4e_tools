# Vision

The final product will be a fully integrated suite of 4th Edition Dungeons and Dragons tools to assist and manage the experience of playing and running a session or campaign.

**Race/class builder fidelity:** See [class-build-options.md](./class-build-options.md) for PHB vs Essentials build indexing, class-feature grants, and power swap/replace. Audit coverage with `tools/etl/list_race_class_selection_gaps.py` and [class-feature-priority-fix-report.md](./class-feature-priority-fix-report.md). Track remaining special cases in [special-cases-refactor-checklist.md](./special-cases-refactor-checklist.md).

## What's Implemented Today

### Data pipeline (ETL)

- Rules ETL (`tools/etl/build_rules_index.py`) → `generated/rules_index.json`
- Consumables catalogs under `generated/catalogs/` (adventuring gear, alchemy, rituals, martial practices)
- Glossary terms at `generated/glossary_terms.json`
- ETL anomaly log at `generated/etl_anomalies.jsonl` (gitignored) for parser improvement loops
- Monster ETL (`tools/etl/build_monster_index.py`) → `generated/monsters/index.json` and `generated/monsters/entries/*.json`
- Optional: `npm run etl:monsters:index-filters` copies keywords/source books into the index for UI filters
- Optional: `generated/monster_templates.json` from `tools/etl/extract_monster_templates_from_pdfs.py` (requires local PDF sources)

### Rules engine (`src/rules/`)

- Prerequisite validation
- Class, hybrid class, theme, paragon path, and epic destiny support
- Multiclass and paragon multiclassing (including psionic power points and augmentation)
- Class + hybrid skill and power-slot legality validation
- Armor/shield proficiency and feat legality filtering
- Derived stat calculations (defenses, skills, HP, psionic resources)
- Race/subrace granted powers and stale power-selection pruning
- Class feature choice groups, trait-package grant expansion, DMG2 role progression power swaps, and `rules.replace` power upgrades
- Class feature mechanical effects (proficiencies, weapon damage/ability) and `rules.modify Power` patches on power cards
- Equipment, magic items, enchantments, and consumables modeling (see [equipment-system-design.md](./equipment-system-design.md))
- Weapon + implement attack preview calculations

### Character Builder (`#/builder`)

- Race/class and hybrid class selection with level advancement (heroic, paragon, epic)
- PHB class-feature picks and Essentials **Class build** dropdown (`buildOptionId`) with suggested power pre-fill
- Ability scores, skills, feats, powers, theme, paragon path, and epic destiny tabs
- Class skill training and live skill sheet modifiers
- Legal feat filtering and class power selection with slot limits
- Armor, weapons, implements, magic items, and consumables
- Live character sheet preview and combat attack previews
- Multiple saved characters with local persistence (`localStorage`)
- JSON import/export

### Character Sheet (`#/character-sheet`)

- Play-mode sheet loaded from saved builder characters
- HP, temp HP, healing surges, second wind, death saves, and rest actions
- Active conditions, psionic power point tracking, and unified inventory/equipment
- Power cards grouped for combat use

### Monsters (`#/monsters`)

- Monster browser with filters (level, role, rank, keywords, source)
- Stat block viewer, JSON editor, and custom monster creation (paste import)
- Monster template browser, preview, and template authoring
- Encounter builder: roster management, DMG-style generator, XP totals, print preview/export

### Glossary Editor (`#/glossary`)

- Edit tooltip glossary terms used across builder, sheet, and monster UIs
- Bundled terms from `generated/glossary_terms.json` with local overrides in `localStorage`

### Resource Editor (`#/resource-editor`)

- Local overlay editor for races, classes, powers, feats, themes, paragon paths, epic destinies, traits, hybrid classes, and equipment
- Changes merge at runtime over the bundled rules index (stored in `localStorage`)

### Cross-cutting

- Light/dark theme toggle (persisted)
- In-app **Feedback** modal posting to `POST /api/reports` (dev: `received_reports/reports.jsonl`; Netlify: GitHub issues via `netlify/functions/reports.ts`)
- Vitest coverage across ETL artifacts, rules engine, builder, character sheet, monster editor, encounter builder, and reporting

### Key folders

- `tools/etl/` — normalization and indexing pipeline (Python)
- `src/rules/` — typed models, prerequisite evaluator, stat calculator, option resolver
- `src/features/builder/` — character builder state, persistence, UI flow
- `src/features/characterSheet/` — play-mode character sheet
- `src/features/monsterEditor/` — monster browser, templates, custom monsters
- `src/features/encounterBuilder/` — encounter rosters, generator, print layout
- `src/features/glossaryEditor/` — glossary term editor
- `src/features/resourceEditor/` — local rules overlay editor
- `src/features/reporting/` — feedback modal and payload validation
- `tests/` — Vitest tests (rules, ETL, features, perf)
- `generated/` — generated rules, catalogs, glossary, and monster JSON artifacts

## Acceptance Checklist

Character builder:

- Build a new level-1 hybrid character and verify legal hybrid power slots are enforced.
- Pick a race/subrace power option, then switch subrace and confirm stale power selections are removed.
- Pick PHB class features (e.g. Fighter Talents) and confirm granted powers appear; pick an Essentials class build and confirm suggested powers pre-fill empty slots.
- Select a pact/domain feature (e.g. Warlock Star Pact) and confirm higher-level pact upgrades replace lower-level powers automatically.
- Add a feat that grants a power and confirm the power appears in character power selections.
- Equip a weapon and implement and verify the attack preview updates (including nonproficient penalty behavior and class-feature weapon modifiers).
- Save the character, open **Character Sheet**, and confirm derived stats and equipment carry over.
- Export and re-import the character JSON and confirm powers/selections/derived stats remain consistent.

Monsters (optional, requires monster ETL):

- Load the monster browser and filter by level/role.
- Add monsters to an encounter roster and verify XP totals update.
- Generate a roster with the encounter generator and print-preview the result.

## Standalone Products

### 1. Character Builder

- Character Builder — **implemented**
- Character Sheets — **implemented**
- Item Store — partial (consumables/equipment in builder)

### 2. Monster Editor

- Browser — **implemented**
- Monster Templates — **implemented**
- Editor/creator — **implemented**
- Encounter Builder — **implemented**

### 3. NPC Creator

### 4. Campaign Notes

### 5. Resource Editor

- **implemented** (local overlay editor)

## Tier 2 Products

### 1. Encounter Tracker

- Dependent on Character Sheets, Encounter Builder
- Track initiative, rounds, hp, statuses, delay
- Global notes
- DM information such as defenses, tactics, etc

### 2. Resource Tracker

- Dependent on Item integration
- Track treasure packages: quantity and distribution.
- Auditable resource tracking, when gold and items was given, lost spent
- (Optional) Tracking of consumables such as food, water and survival supplies

### 3. Campaign builder/tracker

- Node based plot/note journaling
- Item/NPC journaling
- Optional LLM Skills based settings/resource/adventure generator

## Tier 3 Product

### 1. Session hosting

- Local webserver to host session
- Integratation for DM to character sheets to encounter tracker

### 2. Integrated VTT

## Related documentation

| Doc | Purpose |
|-----|---------|
| [class-build-options.md](./class-build-options.md) | PHB vs Essentials builds, class-feature grants, power swap/replace |
| [class-feature-priority-fix-report.md](./class-feature-priority-fix-report.md) | Archived class-feature pass summary + live audit commands |
| [special-cases-refactor-checklist.md](./special-cases-refactor-checklist.md) | Hardcoded-rule refactor tracker |
| [equipment-system-design.md](./equipment-system-design.md) | Equipment slot model (implemented) |
| [cb-parity-audit.md](./cb-parity-audit.md) | Legacy Character Builder parity workflow |
| [ui-bible.md](./ui-bible.md) | UI style guide |
