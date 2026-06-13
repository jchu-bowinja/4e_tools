# Class feature coverage (archived)

The P0/P1 class-feature parity pass is **complete**. This doc records outcomes and points to live audit tooling. The former per-class report generator (`generate_class_feature_priority_report.py`) and `generated-priority-fix-report.json` were removed after the pass shipped.

## Completed work

| Area | Outcome |
|------|---------|
| P0 — Class-feature granted powers | `rules.grant type=Power` on selected features surfaces in builder/sheet |
| P0 — Theme / path power level resolution | Powers inherit level from parent theme/path/destiny features |
| P1 — Nested power & class-feature choice groups | Parent-option sub-picks appended at runtime |
| P1 — `rules.modify Power` | `powerModifications` on class features; power card patches |
| P1 — `rules.modify Weapon` (class-mapped) | `mechanicalEffects` on class features; attack preview |
| P1 — Essentials build suggested powers | `classBuildOptionsByClassId[].powerIds` pre-fill empty slots |
| P1 — `rules.replace` | `powerReplacementRules` (auto) + `powerSwapRules` (player picks) |
| Follow-ups | Trait packages, domain labels, DMG2 role-bucket swaps, `$$LEVEL` pools |

Design details: [class-build-options.md](./class-build-options.md). Refactor tracker: [special-cases-refactor-checklist.md](./special-cases-refactor-checklist.md) (SC-091–101).

## Open gap (not blocking builder)

**Unmapped internal weapon rows** — 127 compendium features have `rules.modify type=Weapon`; ~124 lack a `Class` field (Arena Training internal weapon definitions, etc.). Class-mapped features (Rogue Weapon Talent, Druid of Summer, …) work in attack preview.

## Live audit commands

Run after ETL changes (`python tools/etl/build_rules_index.py`):

```bash
# Level-1 class feature power picks with empty powerIds
python tools/etl/audit_class_feature_choice_power_ids.py

# Racial/class build coverage gaps
python tools/etl/list_race_class_selection_gaps.py

# Racial-trait $$ category metadata
python tools/etl/validate_power_select_categories.py
```

Indexed choice groups live in `rules_index.json` → `classFeatureChoiceGroupsByClassId` (46 classes at last audit).
