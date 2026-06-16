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

## Summary counts (2026-06-13)

| Category | Items | Dup ETL+runtime (remaining) |
|----------|------:|----------------------------:|
| Hardcoded compendium IDs | 6 | 0 |
| Heuristic supplements | 4 | 0 |
| Category / select interpreters (extend) | 5 | 0 |
| Power usage / mechanical overrides | 3 | 0 |
| Feat / power resolution | 3 | 0 |
| Psionic / hybrid tables | 3 | 0 |
| Paragon / MC / path | 2 | 0 |
| Class-feature grants / swap / replace | 6 | 0 |
| Legacy migration | 4 | 0 |
| ETL structural (reference) | 12 | — |

**P0 complete:** SC-001–004 shipped. **P1 complete (2026-05-30):** SC-010–013, SC-022, SC-032, SC-040–041, SC-062. **P2 psionic tables complete (2026-05-30):** SC-050–052. **Class-feature P1 pass complete (2026-06):** SC-091–101 (grants, modify/replace, trait packages, domain labels, role swaps, Essentials power pre-fill). **Next:** SC-080–083 legacy only when touching saves. Regenerate index after ETL changes: `python tools/etl/build_rules_index.py`.

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
| SC-011 | `etl-done` | Signs of Influence (bard) | ETL `_supplement_mapped_optional_class_feature_groups`; index choice groups | HotF optional + level 1/13/17 gated sub-picks | Done via SC-002; `SIGNS_OF_INFLUENCE_CLASS_FEATURE_ID` removed from `src/rules`, defined locally in test | `tests/rules/bardSignsOfInfluence.test.ts` |
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
| SC-032 | `etl-done` | Dynamic `$$` — class-context resolution | `powerSelectCategory.ts`; ETL + `grantedPowersQuery.ts` | `classPowerPool` for `$$CLASS,encounter,1` / `ID_INTERNAL_CATEGORY_*`; bonus at-will unchanged | `powerSelectCategory.ts` | `tests/rules/powerSelectCategory.test.ts`, `audit_class_feature_choice_power_ids.py` |
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
| SC-071 | `etl-done` | Dragonborn ability deferral | `abilityScores.ts` reads `race.abilityBonusSource`; text parse is fallback | "See the Race Chosen" → subrace traits | ETL flag `abilityBonusSource: "subrace"` on race row | `tests/rules/dragonbornAbility.integration.test.ts` |
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
| SC-092 | `done` | Build option ≠ class feature | `characterClassFeatures.ts` | Only `ID_FMP_CLASS_FEATURE_*` in `collectClassFeatureIdsFromClass` | `tests/rules/characterClassFeatures.test.ts` |
| SC-093 | `done` | `$$CLASS,<usage>,<level>` power pools | ETL `build_rules_index.py`; `powerSelectCategory.ts`; `classPowersQuery.ts` | Mage/spellbook encounter+daily+utility; parent class (`_ParentClass`) | `audit_class_feature_choice_power_ids.py`, `powerSelectCategory.test.ts` |
| SC-094 | `done` | Parsed-but-ungranted L1 power picks | ETL `_append_ungranted_power_choice_groups` | Hexblade, Skald, Protector, Elementalist | `audit_class_feature_choice_power_ids.py` (0 L1 gaps) |
| SC-095 | `done` | Extra power-select category shapes | ETL + `powerSelectCategory.ts` | `ID_FMP_CLASS_*,usage,level`; `$$Class,at-will`; feature-ref + `_PARSED_SUB_FEATURES` powers | `powerSelectCategory.test.ts` |
| SC-096 | `done` | Trait package pact chains | `traitPackageIds.ts`; `characterClassFeatures.ts` grant expansion | `traitPackageIdByClassFeatureId` on index | `tests/rules/classFeaturePowerReplace.test.ts`, `characterClassFeatures.test.ts` |
| SC-097 | `done` | DMG2 role-bucket power swaps | `roleProgressionFeatures.ts` reads `feature.roleProgression` flag (no name regex); `classFeaturePowerReplace.ts` | ETL `roleProgression {role, kind}` + `powerSwapRules`; filter by class role | `tests/rules/classFeaturePowerReplace.test.ts` |
| SC-098 | `done` | Class feature `rules.replace` | `classFeaturePowerReplace.ts` | `powerReplacementRules` (auto) + `powerSwapRules` (player `classPowerSwap:*` keys) | `tests/rules/classFeaturePowerReplace.test.ts` |
| SC-099 | `done` | Class feature `rules.modify Power` | `classFeaturePowerModifications.ts` | `powerModifications` on feature row | `tests/rules/classFeaturePowerModifications.test.ts`, `p1ClassFeatureMechanicalPatches.test.ts` |
| SC-100 | `done` | Essentials build suggested powers | `classBuildOptions.ts` → `classPowerSlots.ts` | Pre-fill empty slots from `classBuildOptionsByClassId[].powerIds` | `tests/rules/classBuildOptions.test.ts` |
| SC-101 | `done` | Warpriest domain label requires | `traitPackageIds.ts`; `characterClassFeatures.ts` | `domainLabelByClassFeatureId` satisfies string `requires` | `tests/rules/warpriestDomainGrants.test.ts` |

---

## Data-driven builder refactor closeout (2026-06-14)

Closes the remaining sole-source runtime hardcodes, name heuristics, and the theme/epic-destiny grant gap. All entity-specific behavior now lives in compendium data + `tools/etl/overrides/*.json` (see `docs/data-overlay.md`); `src/rules/*.ts` is generic and the guard test `tests/rules/noEntitySpecificLiterals.test.ts` forbids concrete `ID_*_<n>` literals.

| ID | Status | Item | Runtime | ETL / overlay | Tests |
|----|--------|------|---------|---------------|-------|
| SC-102 | `etl-done` | Wizard / Mage spellbook | `wizardSpellbook.ts` reads `spellbookKind` (+ picks/milestones) | Overlay `classFeatures.spellbookKind`; ETL tags power groups | `tests/rules/wizardSpellbook.test.ts`, `tests/rules/mageSpellbook.test.ts` |
| SC-103 | `etl-done` | Mage school progression chain | `classFeatureChoices.ts` generic `filterSchoolProgressionChoiceOptions` (no Mage ids) | Overlay `classFeatureChoiceGroupSchoolFilters` → group `schoolFilter` | `tests/rules/mageApprenticeMage.test.ts` |
| SC-104 | `etl-done` | Ritual casting / Ritual Caster | `ritualCasting.ts` reads `grantsRitualCasting` | Overlay `ritualCastingFeatureNames` / `ritualCasterFeatNames` → feature/feat flag | `tests/rules/ritualCasting.test.ts` |
| SC-105 | `etl-done` | Theme granted powers/features | `classPowersQuery.ts` reads normalized `grantedPowerIds` | ETL `extract_grants_from_rules` for themes | `tests/rules/classPowersQuery.test.ts` |
| SC-106 | `etl-done` | Epic destiny granted powers/features | `powerSelections.ts` / app read `grantedPowerIds` | ETL `extract_grants_from_rules` for epic destinies | `tests/rules/classPowersQuery.test.ts` |
| SC-107 | `done` | Overlay infrastructure + guardrails | generic interpreters only | `tools/etl/overlay.py` deep-merge + unknown-id validation | `tools/etl/test_overlay.py`, `tests/rules/noEntitySpecificLiterals.test.ts` |

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
  powerModifications?: PowerModification[]; // SC-099
  powerReplacementRules?: ClassFeaturePowerReplacementRule[]; // SC-098
  powerSwapRules?: ClassFeaturePowerSwapRule[]; // SC-097, SC-098
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
  traitPackageIdByClassFeatureId?: Record<string, string>;    // SC-096
  domainLabelByClassFeatureId?: Record<string, string>;       // SC-101
  classFeatureChoiceGroupsByClassId?: Record<string, ChoiceGroup[]>; // SC-034
  classBuildOptionsByClassId?: Record<string, BuildOption[]>; // SC-091, SC-100
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
9. ~~**SC-092–093**~~ — build option fix + `$$CLASS` power pools at ETL (2026-05-30).
10. ~~**SC-094–095**~~ — ungranted L1 power groups + Skald/Protector/Elementalist categories (2026-05-30).
11. ~~**SC-096–101**~~ — trait packages, domain labels, role swaps, power replace/swap, modify Power, Essentials power pre-fill (2026-06).
12. **SC-080–083** — legacy only when touching saves.

---

## Related docs & tooling

| Resource | Path |
|----------|------|
| Class / race build model | `docs/class-build-options.md` |
| Class-feature coverage (archived) | `docs/class-feature-priority-fix-report.md` |
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
| 2026-05-30 | SC-092–093 — build option not a class feature; ETL/runtime `$$CLASS` usage pools (+ parent class) |
| 2026-05-30 | SC-094–095 — ungranted parsed L1 power groups; `ID_FMP_CLASS_*,usage,level` and `$$Class,at-will` |
| 2026-06-13 | SC-096–101 — trait packages, domain labels, role swaps, power replace/swap, modify Power, Essentials power pre-fill; docs refresh |
