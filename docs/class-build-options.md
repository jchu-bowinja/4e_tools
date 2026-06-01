# Class build options (ETL + builder)

Two compendium models feed `classBuildOptionsByClassId` in `rules_index.json`:

1. **PHB talent bundles** — Level-1 class features with `_PARSED_SUB_FEATURES` and a Class Feature `select` (Fighter Talents, Warlord Presence, …). Options use the **sub-feature internal id** and compendium feature **name** (e.g. Arena Training). Player-facing labels from the class `Build Options` field are attached as **`displayName`** when we can match them (Arena Fighter).

2. **Essentials `Build` rows** — Classes with a `rules.select` of type `Build` and comma-separated `Build Options` text (Cleric, Paladin, Artificer). Options use **`ID_FMP_BUILD_*`** ids; `name` is already the player label.

Merge rule: Essentials `Build` rows live in `classBuildOptionsByClassId`. PHB level-1 feature picks live in **`classFeatureChoiceGroupsByClassId`** (one UI dropdown per group).

### Choice groups (examples)

| Class | Group | Options |
|-------|--------|---------|
| Rogue | Rogue Tactics | Artful Dodger, Brutal Scoundrel, … |
| Rogue | Class feature | Rogue Weapon Talent **or** Sharpshooter Talent; Sharpshooter adds crossbow/sling sub-pick (shown only when Sharpshooter is selected) |
| Fighter | Fighter Talents | Arena Training, Battlerager Vigor, … |
| Fighter | Class feature | Combat Agility **or** Combat Superiority |
| Wizard | Arcane Implement Mastery | Orb, Staff, Wand, Tome, … |
| Wizard | Arcanist Cantrips | Pick 4 powers from the cantrip list |

Builder stores picks under `classSelections` keys like `classFeature:ID_FMP_CLASS_FEATURE_547` or `classPower:ID_FMP_CLASS_FEATURE_130` (comma-separated power ids).

Dependent groups use `visibleWhen: { groupKey, optionId }` in the index (e.g. Sharpshooter crossbow/sling only after picking Sharpshooter Talent in the weapon pair). Hidden selections are cleared when the parent pick changes.

Essentials guided builds (`classBuildOptionsByClassId`) appear on the **Class** tab as a **Class build** dropdown when the class has compendium `Build` rows (Cleric, Paladin, Artificer, …). The pick is stored in `classSelections.buildOptionId` (`ID_FMP_BUILD_*`).

## Gaps (no mechanical pick in index)

Some classes have no `Build Options` text and no `Build` select in the merged XML (e.g. Blackguard, Skald, Vampire). Essentials builds are indexed when present but not surfaced in the builder yet.

Run `python tools/etl/list_race_class_selection_gaps.py` to audit racial `rules.select` traits and classes missing indexed build options.

Run `python tools/etl/validate_power_select_categories.py` after ETL to verify racial-trait `$$` categories have index metadata.

Run `python tools/etl/audit_class_feature_choice_power_ids.py` to find level-1 class feature power picks with empty `powerIds` in the index.

## Power select `Category` tokens (racial + class)

Compendium `rules.select` rows with `type="Power"` use a `Category` string. The builder interprets these via `src/rules/powerSelectCategory.ts` (and ETL mirrors key cases onto `racialTraits[]` in the index).

| Category pattern | Meaning | Runtime | ETL on racial trait |
|------------------|---------|---------|---------------------|
| `ID_FMP_POWER_…` (pipe-separated) | Fixed power list | Static ids in pickers | `powerSelectCategory` stores raw string |
| `$$CLASS,at-will,1` | Extra **class** at-will attack slot (pick any 1st-level at-will from your class) | `raceGrantsBonusClassAtWillSlot` / Human bundle default | `grantsBonusClassAtWill: true` |
| `$$NOT_CLASS,at-will,1` | **Dilettante** (Half-Elf): pick another class’s 1st-level at-will; used as encounter | `dilettantePick` + `getDilettanteCandidatePowers` | `powerSelectCategory` + `powerUsageOverride: "Encounter"` |
| Other `$$…` | Class-context dynamic lists (not resolved at ETL) | Skipped in static collectors; resolve at runtime when implemented | — |

**Human Power Selection** (`ID_FMP_RACIAL_TRAIT_2966`): bundle pick between Bonus At-Will (`$$CLASS,at-will,1` on child trait `356`) and Heroic Effort (`2965`). Index fields: `grantsBonusClassAtWillByDefault`, `heroicEffortTraitId`, `bonusAtWillTraitId`.

**Half-Elf Power Selection**: parent trait uses `powerBundleMode: "subtraitFirst"` so the player picks Dilettante (or Knack) before any merged power dropdown.

Class-feature power picks (Channel Divinity, cantrips, etc.) are precomputed in `classFeatureChoiceGroupsByClassId` at ETL; dynamic `$$` categories on class features are not level-1 choice groups unless ETL expands them.

## Racial `rules.select` (builder)

Trait bundles (subrace, Elemental Manifestation, Dragonborn Racial Power, Half-Elf Power Selection, …) use `getRaceTraitBundleSlots` and `raceSelections` keys `subrace` or `racialTrait:${parentId}`.

Per-trait selects use `getRacialTraitRuleSelectSlots`:

- **Skill Training** — e.g. Eladrin Education, Human Bonus Skill (`skillTraining:${traitId}:${n}`)
- **Feat** — Human Bonus Feat (`racialFeat:${traitId}`); selection is also added to `featIds`
- **CountsAsRace** — Revenant Past life (`countsAsRace:${traitId}`); grants matching Past Spirit trait for power picks

## Feat/path prereqs

`generated/etl_anomalies.jsonl` still lists many unparsed feat/path prereq clauses; that is separate from race/class build coverage.
