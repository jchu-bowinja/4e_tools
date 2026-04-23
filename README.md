# D&D 4e Web Builder (MVP)

Web-first, guided D&D 4e character builder using data extracted from the legacy Character Builder.

## What is implemented

- ETL pipeline that normalizes `out_json/*.json` into `generated/rules_index.json`
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
  - local persistence (localStorage)
  - JSON import/export
- Test coverage for ETL artifact presence and rules core behavior

## Setup

1. Install dependencies:
   - `npm install`
2. Build normalized index:
   - `python tools/etl/build_rules_index.py out_json generated`
3. Run app:
   - `npm run dev`
4. Run tests:
   - `npm test`

## Key folders

- `tools/etl/`: normalization and indexing pipeline
- `src/rules/`: typed models, prerequisite evaluator, stat calculator, option resolver
- `src/features/builder/`: builder state, persistence, UI flow
- `tests/`: ETL and rules tests

## Acceptance checklist

- Build a new level-1 hybrid character and verify legal hybrid power slots are enforced.
- Pick a race/subrace power option, then switch subrace and confirm stale power selections are removed.
- Add a feat that grants a power and confirm the power appears in character power selections.
- Equip a weapon and implement and verify the attack preview updates (including nonproficient penalty behavior).
- Export and re-import the character JSON and confirm powers/selections/derived stats remain consistent.

