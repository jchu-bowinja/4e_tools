# Special-case refactor checklist

Tracked inventory of hardcoded rules, heuristic supplements, and legacy paths in the 4e builder (class/race features, powers, feats, interactions). Use this when moving logic into **ETL → `rules_index.json` → general interpreters**.

**Status legend**

| Status | Meaning |
|--------|---------|
| `pending` | Not started; special case still in code |
| `dup` | Same logic in ETL **and** runtime — consolidate first |
| `etl-done` | Precomputed in `rules_index.json`; runtime duplicate removed |
| `legacy` | Old save format only — low priority |
| `keep` | Intentionally general; no entity-specific refactor needed |
| `done` | Shipped (UI or full feature complete) |

**Priority:** P0 = blocks parity / duplicated logic · P1 = high-value generalization · P2 = polish · P3 = legacy

Update **Status** and **Owner** columns as work completes.

---

## Summary counts (2026-05-30)

| Category | Items | Dup ETL+runtime (remaining) |
|----------|------:|----------------------------:|
| Hardcoded compendium IDs | 6 | 0 |
| Heuristic supplements | 4 | 0 |
| Category / select interpreters (extend) | 5 | 0 |
| Power usage / mechanical overrides | 3 | 0 |
| Feat / power resolution | 3 | 0 |
| Psionic / hybrid tables | 3 | 0 |
| Paragon / MC / path | 2 | 0 |
| Legacy migration | 4 | 0 |
| ETL structural (reference) | 2 | — |

**P0 complete:** SC-001–004 shipped. **P1 complete (2026-05-30):** SC-010–013, SC-022, SC-032, SC-040–041, SC-062. **P2 psionic tables complete (2026-05-30):** SC-050–052. **Follow-up (2026-05-30):** SC-030/031 docs + validation; SC-034 audit script; SC-070 gap report extended. **Next:** SC-080–083 legacy, more `$$` class-feature tokens, Essentials build → class-feature grants. Regenerate index after ETL changes: `python tools/etl/build_rules_index.py`.

---

## P0 — Consolidate ETL + runtime duplicates

| ID | Status | Item | Runtime | ETL | Proposed index / handler | Tests |
|----|--------|------|---------|-----|--------------------------|-------|
| SC-001 | `etl-done` | Wizard / Mage cantrip name list | Runtime supplement removed; ETL fills `powerIds` on choice groups | `build_rules_index.py` L1171–1020 | `classFeature.powerPickSupplementIds[]` on feature row or full `select` Category in compendium | `tests/rules/classFeatureChoices.test.ts` |
| SC-002 | `etl-done` | Optional class features by class id (Signs of Influence) | Runtime `supplementMapped*` removed | `build_rules_index.py` L1189–903 | **only in index** `classFeatureChoiceGroupsByClassId` | `tests/rules/bardSignsOfInfluence.test.ts` |
| SC-003 | `etl-done` | Feat power name aliases | `powerNameResolution.ts` reads `index.featPowerNameAliases` | `build_rules_index.py` L2482+ → index | ETL-resolved `powerModifications[].powerId` (aliases fallback) | `tests/rules/powerNameResolution.test.ts`, `rulesIndexPrecomputedFields.test.ts` |
| SC-004 | `etl-done` | Channel Divinity feat power exclusion | `grantedPowersQuery.ts` prefers index; fallback compute | `build_rules_index.py` L1023–1054 → index | `index.featGrantedPowerIdsExcludedFromClassFeaturePicks` | `tests/rules/classFeatureChoices.test.ts`, `rulesIndexPrecomputedFields.test.ts` |

**Also exported with P0:** `paragonPathClassFeaturePowerIds` (feeds SC-023 runtime path; same commit).

**Runtime removed (~200 lines):** `supplementLeaderPickChoiceGroups`, `supplementOptionalParsedClassFeatureGroups`, `supplementMappedOptionalClassFeatureGroups`, wizard cantrip name map in `classFeatureChoices.ts`.

---

## P1 — Hardcoded entity IDs → index fields

| ID | Status | Item | Location | Current behavior | Proposed data | Tests |
|----|--------|------|----------|------------------|---------------|-------|
| SC-010 | `etl-done` | Archer Warlord feature | `classFeatureProficiencies.ts` + `mechanicalEffects.ts` | ETL `mechanicalEffects`; runtime uses index when passed | `mechanicalEffects` on feature row in index | `tests/rules/archerWarlord.test.ts`, `tests/rules/characterProficiencyDisplay.test.ts` |
| SC-011 | `etl-done` | Signs of Influence (bard) | ETL `_supplement_mapped_optional_class_feature_groups`; index choice groups | HotF optional + level 1/13/17 gated sub-picks | Done via SC-002; keep `SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID` export for tests | `tests/rules/bardSignsOfInfluence.test.ts` |
| SC-012 | `etl-done` | Human Power Selection traits | `grantedPowersQuery.ts` | Index `grantsBonusClassAtWillByDefault`, `heroicEffortTraitId`, `bonusAtWillTraitId`; legacy IDs as fallback | Same fields on racial trait row | `tests/etl/humanBonusAtWill.integration.test.ts`, `tests/rules/grantedPowersQuery.test.ts`, `tests/rules/activeRacialTraits.test.ts` |
| SC-013 | `etl-done` | Paragon Power Points class feature | `psionicPowerPoints.ts` | `path.grantsParagonPowerPoints` from ETL; raw grant fallback | `paragonPath.grantsParagonPowerPoints` | `tests/rules/psionicPowerPoints.test.ts` |
| SC-014 | `etl-done` | Mage cantrips feature ids | ETL `MAGE_CANTRIPS_FEATURE_IDS` only | Cantrip `powerIds` on choice groups | Covered by SC-001 | `tests/rules/classFeatureChoices.test.ts` |

---

## P1 — Heuristic supplements → explicit ETL choice groups

| ID | Status | Item | Location | Heuristic | Proposed fix | Tests |
|----|--------|------|----------|-----------|--------------|-------|
| SC-020 | `etl-done` | Warlord Leader pick | ETL `build_class_feature_choice_groups_by_class` (Leader pair group) | Was runtime `endsWith(" Leader")` heuristic | In `classFeatureChoiceGroupsByClassId` only | `tests/rules/warlordLeaderChoice.test.ts` |
| SC-021 | `etl-done` | Single optional parsed class feature | ETL (`remaining_ungranted == 1` → optional group) | Was runtime Archer Warlord–style heuristic | In index only | `tests/rules/archerWarlord.test.ts` |
| SC-022 | `etl-done` | Half-elf parent bundle + Dilettante | `grantedPowersQuery.ts` | `powerBundleMode: "subtraitFirst"` from index; heuristic fallback | `racialTrait.powerBundleMode` | `tests/rules/dilettantePower.test.ts`, `tests/rules/grantedPowersQuery.test.ts` |
| SC-023 | `etl-done` | Paragon path powers in class feature picks | `grantedPowersQuery.ts` uses `index.paragonPathClassFeaturePowerIds` when set | Global exclusion set at ETL; runtime compute fallback | `paragonPathClassFeaturePowerIds` + filter in `classFeaturePowerIdsForClass` | `tests/rules/grantedPowersQuery.paragon.test.ts` |

---

## P1 — Generalize Category / `rules.select` (extend, don’t duplicate)

| ID | Status | Item | Location | Token / rule | Action | Tests |
|----|--------|------|----------|--------------|--------|-------|
| SC-030 | `etl-done` | Bonus class at-will slot | `powerSelectCategory.ts`; `grantedPowersQuery.ts` | `$$CLASS,at-will,1` | Documented in `class-build-options.md`; ETL `grantsBonusClassAtWill` | `tests/etl/humanBonusAtWill.integration.test.ts`, `validate_power_select_categories.py` |
| SC-031 | `etl-done` | Dilettante candidate pool | `powerSelectCategory.ts`; `classPowersQuery.ts` | `$$NOT_CLASS,at-will,1` | Documented + `validate_power_select_categories.py` | `tests/rules/dilettantePower.test.ts`, `tools/etl/test_validate_power_select_categories.py` |
| SC-032 | `etl-done` | Dynamic `$$` — no static power ids | `powerSelectCategory.ts`; `grantedPowersQuery.ts` | `isDynamicPowerSelectCategory`; `resolvePowerIdsFromCategory` for class-context resolution | `powerSelectCategory.ts` module | `tests/rules/powerSelectCategory.test.ts` |
| SC-033 | `keep` | Racial trait rule selects | `racialTraitRuleSelects.ts` | Skill Training / Feat / CountsAsRace + `requires` | Keep; extend prereq `!Class` parsing if gaps found | `tests/rules/racialTraitRuleSelects.test.ts` |
| SC-034 | `etl-done` | Class feature choice groups (indexed) | `getClassFeatureChoiceGroups` maps index only (+ `expandClassFeaturePowerChoiceGroups`) | `powerIds` precomputed at ETL; audit via `audit_class_feature_choice_power_ids.py` | `tests/rules/classFeatureChoices.test.ts`, `audit_class_feature_choice_power_ids.py` |

**Proposed module:** `src/rules/powerSelectCategory.ts` — single interpreter for all `$$FOO,bar,baz` tokens + registry.

---

## P1 — Mechanical overrides (usage, display)

| ID | Status | Item | Location | Override | Proposed | Tests |
|----|--------|------|----------|----------|----------|-------|
| SC-040 | `etl-done` | Dilettante → Encounter usage | `dilettantePower.ts` | `racialTrait.powerUsageOverride` from ETL; `applyPowerUsageOverride` | `powerUsageOverride: "Encounter"` on Dilettante trait | `tests/rules/dilettantePower.test.ts` |
| SC-041 | `etl-done` | Class feature power list class filter | `classFeatureChoices.ts` | Uses `paragonPathClassFeaturePowerIds` + `featGrantedPowerIdsExcludedFromClassFeaturePicks` from index | Index exclusion sets (SC-004, SC-023) | `tests/rules/classFeatureChoices.test.ts` |
| SC-042 | `keep` | Psionic augment variant collapse | `psionicPowerAugments.ts` L4–44 | Hides augment rows in pickers | Keep pattern-based; optional ETL `isAugmentVariant` on power row | `tests/rules/psionicPowerAugments.test.ts` |

---

## P2 — Psionic / hybrid (tables in code)

| ID | Status | Item | Location | Notes | Proposed | Tests |
|----|--------|------|----------|-------|----------|-------|
| SC-050 | `etl-done` | Psionic Augmentation PP by level | `psionicPowerPoints.ts` | `index.psionicPowerPointsByLevel`; fallback table in TS | ETL PHB3 table on index | `tests/rules/psionicPowerPoints.test.ts`, `tools/etl/test_psionic_index_fields.py`, `rulesIndexPrecomputedFields.test.ts` |
| SC-051 | `etl-done` | Hybrid psionic breakpoints | `hybridPsionicAugmentation.ts` | `index.hybridPsionicAugmentationBreakpoints`; optional `index` param | ETL `[7,13,17,23,27]` | `tests/rules/hybridPsionicAugmentation.test.ts`, `tests/rules/hybridPsionicPowerPoints.test.ts` |
| SC-052 | `etl-done` | Paragon MC at-will penalty | `psionicPowerPoints.ts`; `hybridPowerSlots.ts` | `index.paragonMulticlassNonPsionicToPsionicAtWillPenalty` | ETL default `1` | `tests/rules/paragonPsionicAtWillPenalty.test.ts`, `tests/rules/hybridParagonPsionicMc.test.ts` |

---

## P2 — Feat / class feature / power graph

| ID | Status | Item | Location | Notes | Proposed | Tests |
|----|--------|------|----------|-------|----------|-------|
| SC-060 | `keep` | Feat grants / modify / replace (ETL) | `FEAT_RULES_COVERAGE.md`; feat fields on `Feat` | Primary pipeline | Extend consumers (initiative, skills) per doc | `tests/rules/featPowerModifications.test.ts`, `featPowerReplace`, `featMulticlassSlotSwap` |
| SC-061 | `keep` | Feat augments on class features | `featClassFeatureModifications.ts` | When modify target is feature not power | Keep; ensure ETL sets `classFeatureId` | `tests/rules/featClassFeatureModifications.test.ts` |
| SC-062 | `etl-done` | Heritage feat limit | `internalGrantValidation.ts` | `internalGrantKeys` includes `HERITAGE` from ETL; name suffix fallback | ETL appends `HERITAGE` on Heritage/Bloodline feats | `tests/rules/internalGrantValidation.test.ts` |
| SC-063 | `keep` | Psionic second class limit | `internalGrantValidation.ts` L9–19 | `PSIONIC_SECOND_CLASS` internal grant | Keep pattern | `tests/rules/featGrantFlags.test.ts` |

---

## P2 — Race / ability / subrace

| ID | Status | Item | Location | Notes | Proposed | Tests |
|----|--------|------|----------|-------|----------|-------|
| SC-070 | `etl-done` | Subrace / bundle detection | `raceSubraces.ts` | `_SUBRACE_` id alias, power selection category | `list_race_class_selection_gaps.py` reports `racialPowerSelectIndexFields` | `tests/rules/raceSubraces.test.ts` |
| SC-071 | `keep` | Dragonborn ability deferral | `abilityScores.ts` L154–187 | "See the Race Chosen" → subrace traits | Keep; optional ETL flag `abilityBonusSource: subrace` | `tests/rules/dragonbornAbility.integration.test.ts` |
| SC-072 | `keep` | Active racial trait expansion | `activeRacialTraits.ts`; `racialTraitGrants.ts` | Grant children, bundle visibility | Keep | `tests/rules/activeRacialTraits.test.ts`, `racialTraitGrants` |

---

## P3 — Legacy migration (deprecate over time)

| ID | Status | Item | Location | Notes |
|----|--------|------|----------|-------|
| SC-080 | `legacy` | `humanPowerOption` race key | `grantedPowersQuery.ts` L122, L152–153; `models.ts` L596 | Prefer bundle `subrace` key |
| SC-081 | `legacy` | `migrateLegacyClassPowerSelections` | `classFeatureChoices.ts` L663–709 | Old `classPower:featureId` comma keys |
| SC-082 | `legacy` | `legacyFeatNamesSet` armor/shield | `featProficiencies.ts` L219–251 | Pre-grant feat text proficiencies |
| SC-083 | `legacy` | Equipment / magic item migration | `equipment.ts` L25–349; `storage.ts` | Flat ids → slot model |

---

## Reference — ETL structural (not entity hacks)

| ID | Status | Item | Location | Notes |
|----|--------|------|----------|-------|
| SC-090 | `keep` | Subclass grant filtering (Warpriest / Warlock) | `build_rules_index.py` L351–378 | General `_class_feature_applies_to_support_class` |
| SC-091 | `done` | Essentials guided builds in UI | `CharacterBuilderApp.tsx`; `classBuildOptions.ts` | Class tab picker; `classSelections.buildOptionId` | `tests/rules/classBuildOptions.test.ts` |

---

## Proposed `rules_index.json` shapes (sketch)

Use these as targets when implementing SC-001–052; adjust names to match `models.ts`.

```ts
// Per racial trait (ETL)
interface RacialTraitIndexExtras {
  powerSelectCategory?: string;           // e.g. "$$NOT_CLASS,at-will,1"
  powerUsageOverride?: string;            // SC-040 (e.g. "Encounter")
  grantsBonusClassAtWillByDefault?: boolean; // SC-012 Human Power Selection
  heroicEffortTraitId?: string;
  bonusAtWillTraitId?: string;
  powerBundleMode?: "subtraitFirst";      // SC-022
  grantsBonusClassAtWill?: boolean;       // SC-030
}

// Per class feature (ETL)
interface ClassFeatureIndexExtras {
  powerPickSupplementPowerIds?: string[]; // SC-001
  mechanicalEffects?: MechanicalEffect[]; // SC-010
}

// Per paragon path (ETL)
interface ParagonPathIndexExtras {
  grantsParagonPowerPoints?: boolean;     // SC-013
}

// Global index (ETL)
interface RulesIndexExtras {
  featGrantedPowerIdsExcludedFromClassFeaturePicks?: string[]; // SC-004
  featPowerNameAliases?: Record<string, string>;              // SC-003 (or fix in ETL)
  psionicPowerPointsByLevel?: Record<string, number>;         // SC-050
  hybridPsionicAugmentationBreakpoints?: number[];          // SC-051
  paragonMulticlassNonPsionicToPsionicAtWillPenalty?: number; // SC-052
}
```

```ts
// Unified interpreter (runtime) — SC-030–032
type PowerSelectContext = {
  classId?: string;
  hybridClassIds?: [string?, string?];
  level: number;
};
function resolvePowerIdsFromCategory(
  category: string,
  index: RulesIndex,
  ctx: PowerSelectContext
): string[] | "dynamic";
```

---

## Suggested implementation order

1. ~~**SC-004** + **SC-001** + **SC-002** (+ SC-020/021/023/034)~~ — **done** (2026-05-30).
2. ~~**SC-030–032**~~ — `powerSelectCategory.ts`; wired in `grantedPowersQuery.ts`.
3. ~~**SC-040**~~ — `powerUsageOverride` on racial traits.
4. ~~**SC-020–021**~~ — done in ETL (P0 pass).
5. ~~**SC-010, SC-012–013, SC-022, SC-041, SC-062**~~ — P1 index fields + runtime (2026-05-30).
6. ~~**SC-050–052**~~ — psionic tables to index (P2, 2026-05-30).
7. ~~**SC-030/031 docs + validation; SC-034 audit**~~ — done (2026-05-30).
8. ~~**SC-091**~~ — Essentials guided builds UI (2026-05-30).
9. **SC-080–083** — legacy only when touching saves.

---

## Related docs & tooling

| Resource | Path |
|----------|------|
| Class / race build model | `docs/class-build-options.md` |
| Feat rules coverage | `tools/etl/FEAT_RULES_COVERAGE.md` |
| CB parity workflow | `docs/cb-parity-audit.md` |
| Gap audit script | `python tools/etl/list_race_class_selection_gaps.py` |
| Power select validation | `python tools/etl/validate_power_select_categories.py` |
| Class feature powerIds audit | `python tools/etl/audit_class_feature_choice_power_ids.py` |
| Heavy feat rules | `python tools/etl/list_feat_rules_beyond_statadd.py` |
| Original audit conversation | Special-case audit (2026-05-30) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | Initial checklist from codebase audit |
| 2026-05-30 | SC-001–004: ETL exports + runtime duplicate supplements removed |
| 2026-05-30 | Checklist updated: SC-011/014/020/021/023/034 marked etl-done; P0 summary |
| 2026-05-30 | P1: SC-010–013, SC-022, SC-032, SC-040–041, SC-062 — ETL index fields, `powerSelectCategory.ts`, `mechanicalEffects.ts`, regenerated `rules_index.json` |
| 2026-05-30 | P2: SC-050–052 — `psionicPowerPointsByLevel`, hybrid breakpoints, paragon MC at-will penalty on index |
| 2026-05-30 | SC-030/031/034/070 follow-up — `class-build-options.md` power tokens; validate/audit scripts; gap report |
| 2026-05-30 | SC-091 — Essentials class build picker on Class tab |
