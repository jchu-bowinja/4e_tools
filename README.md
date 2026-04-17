# D&D 4e Web Builder (MVP)

Web-first, guided D&D 4e character builder using data extracted from the legacy Character Builder.

## What is implemented

- ETL pipeline that normalizes `out_json/*.json` into `generated/rules_index.json`
- ETL anomaly log at `generated/etl_anomalies.jsonl` for parser improvement loops
- Rules modules for:
  - prerequisite validation
  - class skill and level-1 power-slot legality validation
  - armor/shield proficiency legality checks
  - feat legality filtering
  - derived stat calculations including class defense and armor/shield AC bonuses
- React + TypeScript web UI with:
  - race/class selection
  - ability score editing
  - class skill training selection
  - legal feat filtering
  - class power selection with level-1 at-will/encounter/daily slot limits
  - armor and shield selection
  - live character sheet
  - local persistence (localStorage)
  - JSON import/export
- Test coverage for ETL artifact presence and rules core behavior

## Setup

1. Install dependencies:
   - `npm.cmd install`
2. Build normalized index:
   - `python tools/etl/build_rules_index.py out_json generated`
3. Run app:
   - `npm.cmd run dev`
4. Run tests:
   - `npm.cmd test`

## Key folders

- `tools/etl/`: normalization and indexing pipeline
- `src/rules/`: typed models, prerequisite evaluator, stat calculator, option resolver
- `src/features/builder/`: builder state, persistence, UI flow
- `tests/`: ETL and rules tests

