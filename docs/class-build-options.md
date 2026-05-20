# Class build options (ETL + builder)

Two compendium models feed `classBuildOptionsByClassId` in `rules_index.json`:

1. **PHB talent bundles** — Level-1 class features with `_PARSED_SUB_FEATURES` and a Class Feature `select` (Fighter Talents, Warlord Presence, …). Options use the **sub-feature internal id** and compendium feature **name** (e.g. Arena Training). Player-facing labels from the class `Build Options` field are attached as **`displayName`** when we can match them (Arena Fighter).

2. **Essentials `Build` rows** — Classes with a `rules.select` of type `Build` and comma-separated `Build Options` text (Cleric, Paladin, Artificer). Options use **`ID_FMP_BUILD_*`** ids; `name` is already the player label.

Merge rule: grant-based options win when both exist for a class (Fighter keeps talents, not duplicate Build rows).

## Gaps (no mechanical pick in index)

Some classes have no `Build Options` text and no `Build` select in the merged XML (e.g. Blackguard, Skald, Vampire). The builder does not show a build dropdown for them.

Run `python tools/etl/list_race_class_selection_gaps.py` to audit racial `rules.select` traits and classes missing indexed build options.

## Racial `rules.select` (builder)

Trait bundles (subrace, Elemental Manifestation, Dragonborn Racial Power, Half-Elf Power Selection, …) use `getRaceTraitBundleSlots` and `raceSelections` keys `subrace` or `racialTrait:${parentId}`.

Per-trait selects use `getRacialTraitRuleSelectSlots`:

- **Skill Training** — e.g. Eladrin Education, Human Bonus Skill (`skillTraining:${traitId}:${n}`)
- **Feat** — Human Bonus Feat (`racialFeat:${traitId}`); selection is also added to `featIds`
- **CountsAsRace** — Revenant Past life (`countsAsRace:${traitId}`); grants matching Past Spirit trait for power picks

## Feat/path prereqs

`generated/etl_anomalies.jsonl` still lists many unparsed feat/path prereq clauses; that is separate from race/class build coverage.
