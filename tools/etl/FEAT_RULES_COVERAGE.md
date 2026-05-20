# Feat rules coverage (ETL vs Character Builder `raw.rules`)

This doc explains what the app gets from feats **without** reading `raw` at runtime, how to measure gaps, and a sensible order for future ETL or manual handling.

## What `build_rules_index.py` already normalizes

For feats (and the same helpers for themes, paragon paths, epic destinies):

| Source | Index fields | Used by app for passive math |
|--------|----------------|------------------------------|
| `raw.rules.statadd` | `statAdds` | `passiveDefenseBonusesFromStatAdds` (+ other future always-on stats) |
| `raw.specific["Bonus to Defense"]` | `nadBonusesFromSpecific` | NAD bumps alongside `statAdds` |
| `rules.grant` type Power / Class Feature / Racial Trait | `grantedPowerIds`, `grantedClassFeatureIds`, `grantedRacialTraitIds` | Feat powers, class features on sheet/builder |
| `rules.modify` type Power + `specific['Associated Powers']` | `modifiedPowerIds`, `powerModifications` | Style / arena fighting augmentations (not grants) |
| `rules.replace` `power-replace` + `_DisplayPowers` | `powerReplaceOffers` | Named optional class slot swaps (Gythka, weapon mastery, …) |
| `rules.replace` `multiclass` + `Level` (no `power-replace`) | `multiclassSlotSwapOffers` | PHB Novice / Acolyte / Adept + PHB3 psionic slot swaps (user picks multiclass power) |
| `rules.grant` type Proficiency | `proficiencyGrants` | Weapon/armor/shield/implement validation and attack previews |
| `rules.grant` type Multiclass | `hasMulticlassGrant` | Multiclass feat detection in builder summary |
| `rules.grant` type CountsAsClass | `countsAsClassNames`, `countsAsClassIds` | Class prereqs (e.g. paragon feats for trained class) |
| `rules.grant` type Internal | `internalGrantKeys` | Bloodline, ki focus, psionic second class flags; bloodline prereqs |
| `rules.grant` type Skill Training | `grantedSkillTrainingNames`, `grantedSkillTrainingIds` | Auto-trained skills (multiclass entry feats, etc.) |
| `rules.grant` type CountsAsFeature | `countsAsFeatureNames`, `countsAsFeatureIds` | Class feature prereqs (resolved to compendium feature names) |

Everything else in `raw` (body text, prereqs, `rules.grant`, etc.) is still available on the serialized `raw` object for display or future parsers.

## Partition of all feats (sanity check)

Run a fresh snapshot (counts depend on your `Feat.json` / index):

```bash
python tools/etl/list_feat_rules_beyond_statadd.py --summary-only --key-combo-top 15
```

The script prints:

1. **Feat `raw.rules` snapshot** — how many feats have missing/non-dict `rules`, only `statadd`, etc.
2. **“Heavy” feats** — `raw.rules` contains at least one key **other than** `statadd` (these often need grant/modify/select handling).
3. **Per-key counts** — how many heavy feats touch each CB rule tag (`grant`, `modify`, …).
4. **Top key combinations** — e.g. `[grant]`, `[modify]`, `[grant,modify,select]` to spot dominant patterns.

Example snapshot from a recent `rules_index.json` (3,707 feats):

- `rules` missing or not an object: **1,735** (text-only / no machine rules in extract).
- `rules` keys are **only** `statadd`: **756** (fully covered for statadd-driven effects; NAD may still come from `specific`).
- At least one non-`statadd` rule key: **1,216** (“heavy” rows).
  - Of those, **122** also include `statadd` (ETL still picks up numeric bonuses where present).
  - **1,094** have extra keys but **no** `statadd` (bonuses are almost entirely in `grant` / `modify` / `textstring`, etc.).

## What each non-`statadd` key usually means

| Key | Typical meaning | ETL / app priority |
|-----|-----------------|-------------------|
| **grant** | Grants a power, trait, or keyword the CB tracks | High for **power/trait** automation (links to `Power` ids, validation). |
| **select** | Player picks from a list (powers, skills, options) | High; overlaps with builder UX (already partially handled elsewhere for class features). |
| **modify** | Alters an existing power or property | Medium–high; often needs structured targets in data or one-off rules. |
| **replace** | Swaps a class feature or power | Medium; similar to modify + validation. |
| **textstring** | Freeform reminder text in CB | Low for math; keep as narrative unless it encodes a number worth parsing. |
| **drop** | Removes something | Low volume; handle case-by-case. |

Per-key **frequency** on heavy feats (same sample as above): `grant` 546, `modify` 489, `select` 154, `replace` 106, `textstring` 98, `drop` 4.

Top **combinations** often reduce to a single dominant tag (`[grant]`, `[modify]`, …) or `grant` + `modify` + `select` for complex option feats—use `--key-combo-top` to see your extract.

## Suggested follow-up order (engineering)

1. **Stat / NAD only** — Already largely done via `statAdds` + `nadBonusesFromSpecific`; extend `statAdds` consumer in the app for initiative, skills, etc., when ETL stays truthful to CB rows.
2. **grant → structured grants** — Normalize `grant` entries into explicit `grantedPowerIds` / `grantedFeatureIds` (or equivalent) for feats that should match class-feature behavior.
3. **select** — Same as builder option lists: expose selectable internal ids where stable.
4. **modify / replace** — Highest variance; consider per-family parsers (e.g. “damage type”, “range”) or leave as manual + `raw` until patterns justify code.
5. **textstring** — Last for mechanics; use for QA strings or human-readable tooltips only unless regex-safe.

## Machine-readable list of heavy feats

```bash
python tools/etl/list_feat_rules_beyond_statadd.py --json -o generated/feat_heavy_rules.json
```

Add `generated/feat_heavy_rules.json` to `.gitignore` if you do not want it committed (large, regenerable).

## Runtime follow-ups (multiclass pass 2)

- **Paragon multiclassing** — `paragonMulticlassing` + `paragonMulticlassPowers` wired to builder UI, power card index, character sheet combat powers, and at-will swap into class slots.
- **Psionic power points** — class pool from Psionic Augmentation (single-class table) or hybrid augmentable at-will table; feat swap deltas; paragon +2 PP (multiclass, path `Paragon Power Points` grant, or class tier when no path); non-psionic → psionic paragon MC loses one at-will slot (single-class and hybrid). Character sheet tracks spent/remaining and refreshes on long rest. Hybrid assumes power-point option at all augmentation breakpoints.
- **Feat power modification resolution** — ETL + runtime resolve compendium ids, normalized names, and known aliases so augmentations attach to power cards. A few class-specific names may still lack compendium rows.
- **Internal grants** — `KI_FOCUS_USER`, `PSIONIC_SECOND_CLASS`, bloodline heritage limits in `internalGrantValidation.ts`.
- **Compendium tags** — `MULTICLASS` / `Unlimited Multiclass` prereq tags on entry feats evaluated in `prereqEvaluator`.

## Themes, paragon paths, epic destinies

The same `statAdds` / `nadBonusesFromSpecific` pipeline applies. A separate audit script can mirror this file’s logic over `themes`, `paragonPaths`, and `epicDestinies` in `rules_index.json` when you want parity reporting.
