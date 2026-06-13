# Class feature priority fix — affected classes report

Generated from `generated/rules_index.json`. Regenerate: `python tools/etl/generate_class_feature_priority_report.py`

## Summary

| Step | Status | Classes | Items | Compendium features (global) |
|------|--------|---------|-------|------------------------------|
| P0 — Class-feature granted powers | Fixed (`5609f82`) | 63 | 156 | — |
| P0 — Theme / path power level resolution | Fixed (`5609f82`) | — | — | — |
| P1a — Nested power choice groups | Fixed (`9b4c41e`) | 2 | 2 | — |
| P1b — Nested class-feature choice groups | Fixed (`9b4c41e`) | 2 | 5 | — |
| P1c — `rules.modify Power` (power cards) | Partial (`9b4c41e`) | 27 | 99 | 183 |
| P1d — `rules.modify Weapon` | Open | 3 | 3 | 127 |
| P1e — Essentials build suggested powers | Fixed (`9b4c41e`) | 24 | 77 | — |
| P1f — `rules.replace` | Open | 7 | 36 | 66 |

**Notes:**

- **P1a/P1b** counts are *player-visible* nested picks (parent option in an indexed `classFeature` group). Hybrid/internal-only Power selects (~90 in the audit) are excluded.
- **P1d** compendium has 127 `modify Weapon` rows; most are internal Arena Weapon entries without a `Class` field — see [unmapped section](#p1d-unmapped-weapon-modify-features).
- **Indexed choice groups** exist for 46 classes; full list in [appendix](#appendix-indexed-choice-groups-by-class).

## P0 — Class-feature granted powers

_When the player selects a class-feature option, `rules.grant type=Power` on that feature must appear on the character._

**Status:** Fixed (5609f82)

### Ardent

| Choice path | Feature | Detail |
| --- | --- | --- |
| Ardent Mantle → Mantle of Clarity | Mantle of Clarity | 1 |
| Ardent Mantle → Mantle of Elation | Mantle of Elation | 1 |
| Ardent Mantle → Mantle of Impulsiveness | Mantle of Impulsiveness | 1 |
| Auto-granted: Ardent Surge | Ardent Surge | 1 |

### Artificer

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Infusion | Healing Infusion | 1 |

### Assassin

| Choice path | Feature | Detail |
| --- | --- | --- |
| Guild Training → Executioner's Guild | Executioner's Guild | 1 |
| Shade Form → Shade Form | Shade Form | 1 |
| Auto-granted: Assassin's Shroud | Assassin's Shroud | 1 |
| Auto-granted: Shadow Step | Shadow Step | 1 |

### Avenger

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Channel Divinity | Channel Divinity | 5 |
| Auto-granted: Oath of Enmity | Oath of Enmity | 1 |

### Barbarian

| Choice path | Feature | Detail |
| --- | --- | --- |
| Feral Might → Rageblood Vigor | Rageblood Vigor | 1 |
| Feral Might → Thaneborn Triumph | Thaneborn Triumph | 1 |
| Feral Might → Thunderborn Wrath | Thunderborn Wrath | 1 |
| Feral Might → Whirling Slayer | Whirling Slayer | 1 |
| Auto-granted: Rage Strike | Rage Strike | 1 |

### Bard

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Majestic Word | Majestic Word | 1 |
| Auto-granted: Words of Friendship | Words of Friendship | 1 |

### Battlemind

| Choice path | Feature | Detail |
| --- | --- | --- |
| Psionic Study → Battle Resilience | Battle Resilience | 1 |
| Psionic Study → Persistent Harrier | Persistent Harrier | 1 |
| Psionic Study → Speed of Thought | Speed of Thought | 1 |
| Psionic Study → Wild Focus | Wild Focus | 1 |
| Auto-granted: Psionic Defense | Psionic Defense | 3 |

### Berserker (Essentials, parent: Barbarian)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Defender Aura → Defender Aura | Defender Aura | 1 |
| Auto-granted: Vengeful Guardian | Vengeful Guardian | 1 |

### Binder (Essentials, parent: Warlock)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Pact Boon (Binder) → Gloom Pact Boon (Binder) | Gloom Pact Boon (Binder) | 2 |
| Pact Boon (Binder) → Star Pact Boon (Binder) | Star Pact Boon (Binder) | 2 |
| Auto-granted: Shadow Claws | Shadow Claws | 1 |

### Blackguard (Essentials, parent: Paladin)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Dread Smite | Dread Smite | 1 |
| Auto-granted: Shroud of Shadow | Shroud of Shadow | 1 |
| Auto-granted: Vengeance Strike | Vengeance Strike | 1 |

### Bladesinger (Essentials, parent: Wizard)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Magic Missile | Magic Missile | 1 |
| Auto-granted: Bladesong | Bladesong | 1 |

### Cavalier (Essentials, parent: Paladin)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Virtue At-Will Power → Sacrifice At-Will Power | Sacrifice At-Will Power | 1 |
| Virtue At-Will Power → Valor At-Will Power | Valor At-Will Power | 1 |

### Cleric

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Word | Healing Word | 1 |
| Auto-granted: Channel Divinity | Channel Divinity | 5 |

### Druid

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Wild Shape | Wild Shape | 1 |

### Elementalist (Essentials, parent: Sorcerer)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Elemental Bolt | Elemental Bolt | 1 |
| Auto-granted: Escalating Elements | Escalating Elements | 4 |

### Executioner (Essentials, parent: Assassin)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Guild Attacks → League of Whispers | League of Whispers | 3 |
| Guild Attacks → Red Scales | Red Scales | 3 |
| Guild Attacks → Way of the Ninja | Way of the Ninja | 3 |
| Auto-granted: Assassin's Strike | Assassin's Strike | 1 |

### Fighter

| Choice path | Feature | Detail |
| --- | --- | --- |
| Class feature → Combat Agility | Combat Agility | 1 |
| Auto-granted: Combat Challenge | Combat Challenge | 1 |

### Hexblade (Essentials, parent: Warlock)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Pact Boon → Elemental Pact Boon | Elemental Pact Boon | 1 |
| Pact Boon → Fey Pact Boon | Fey Pact Boon | 1 |
| Pact Boon → Fey Pact of the White Well Boon | Fey Pact of the White Well Boon | 1 |
| Pact Boon → Gloom Pact Boon (Hexblade) | Gloom Pact Boon (Hexblade) | 1 |
| Pact Boon → Infernal Pact Boon | Infernal Pact Boon | 1 |
| Pact Boon → Star Pact Boon | Star Pact Boon | 1 |
| Pact Weapon → Elemental Pact Weapon | Elemental Pact Weapon | 2 |
| Pact Weapon → Fey Pact of the White Well Weapon | Fey Pact of the White Well Weapon | 2 |
| Pact Weapon → Fey Pact Weapon | Fey Pact Weapon | 2 |
| Pact Weapon → Gloom Pact Weapon | Gloom Pact Weapon | 2 |
| Pact Weapon → Infernal Pact Weapon | Infernal Pact Weapon | 2 |
| Pact Weapon → Star Pact Weapon | Star Pact Weapon | 2 |

### Hunter (Essentials, parent: Ranger)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Disruptive Shot | Disruptive Shot | 1 |
| Auto-granted: Expert Archer | Expert Archer | 3 |

### Hybrid Ardent

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Ardent Surge (Hybrid) | Ardent Surge (Hybrid) | 1 |

### Hybrid Artificer

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Infusion (Hybrid) | Healing Infusion (Hybrid) | 2 |

### Hybrid Assassin

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Assassin's Shroud (Hybrid) | Assassin's Shroud (Hybrid) | 1 |

### Hybrid Avenger

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Oath of Enmity (Hybrid) | Oath of Enmity (Hybrid) | 2 |

### Hybrid Bard

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Majestic Word (Hybrid) | Majestic Word (Hybrid) | 1 |

### Hybrid Battlemind

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Psionic Defense (Hybrid) | Psionic Defense (Hybrid) | 1 |

### Hybrid Cavalier

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Righteous Radiance | Righteous Radiance | 1 |

### Hybrid Cleric

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Word (Hybrid) | Healing Word (Hybrid) | 1 |

### Hybrid Druid

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Wild Shape | Wild Shape | 1 |

### Hybrid Fighter

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Combat Challenge (Hybrid) | Combat Challenge (Hybrid) | 1 |

### Hybrid Paladin

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Divine Challenge (Hybrid) | Divine Challenge (Hybrid) | 1 |

### Hybrid Ranger

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Hunter's Quarry (Hybrid) | Hunter's Quarry (Hybrid) | 1 |

### Hybrid Runepriest

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Rune of Mending (Hybrid) | Rune of Mending (Hybrid) | 1 |

### Hybrid Seeker

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Inevitable Shot (Hybrid) | Inevitable Shot (Hybrid) | 2 |

### Hybrid Sentinel

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Word (Hybrid Sentinel) | Healing Word (Hybrid Sentinel) | 1 |

### Hybrid Shaman

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Speak with Spirits | Speak with Spirits | 1 |
| Auto-granted: Companion Spirit (Hybrid) | Companion Spirit (Hybrid) | 1 |
| Auto-granted: Healing Spirit (Hybrid) | Healing Spirit (Hybrid) | 1 |

### Hybrid Warden

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Nature's Wrath (Hybrid) | Nature's Wrath (Hybrid) | 2 |

### Hybrid Warlock

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Warlock's Curse (Hybrid) | Warlock's Curse (Hybrid) | 1 |

### Hybrid Warlord

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Inspiring Word (Hybrid) | Inspiring Word (Hybrid) | 1 |

### Invoker

| Choice path | Feature | Detail |
| --- | --- | --- |
| Divine Covenant → Covenant of Malediction | Covenant of Malediction | 1 |
| Divine Covenant → Covenant of Preservation | Covenant of Preservation | 1 |
| Divine Covenant → Covenant of Wrath | Covenant of Wrath | 1 |
| Auto-granted: Channel Divinity | Channel Divinity | 5 |

### Knight (Essentials, parent: Fighter)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Power Strike | Power Strike | 1 |

### Leader

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Healing Word (Companion) | Healing Word (Companion) | 1 |

### Mage (Essentials, parent: Wizard)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Mage's Spellbook | Mage's Spellbook | 1 |
| Auto-granted: Magic Missile | Magic Missile | 1 |

### Monk

| Choice path | Feature | Detail |
| --- | --- | --- |
| Monastic Tradition → Centered Breath | Centered Breath | 1 |
| Monastic Tradition → Desert Wind | Desert Wind | 1 |
| Monastic Tradition → Eternal Tide | Eternal Tide | 1 |
| Monastic Tradition → Iron Soul | Iron Soul | 1 |
| Monastic Tradition → Stone Fist | Stone Fist | 1 |

### Paladin

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Divine Challenge | Divine Challenge | 1 |
| Auto-granted: Channel Divinity | Channel Divinity | 5 |

### Protector (Essentials, parent: Druid)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Nature's Growth | Nature's Growth | 1 |
| Auto-granted: Summon Natural Ally | Summon Natural Ally | 1 |

### Psion

| Choice path | Feature | Detail |
| --- | --- | --- |
| Discipline Focus → Shaper Focus | Shaper Focus | 2 |
| Discipline Focus → Telekinesis Focus | Telekinesis Focus | 2 |
| Discipline Focus → Telepathy Focus | Telepathy Focus | 2 |

### Ranger

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Hunter's Quarry | Hunter's Quarry | 1 |

### Runepriest

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Rune of Mending | Rune of Mending | 1 |

### Scout (Essentials, parent: Ranger)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Power Strike | Power Strike | 1 |
| Auto-granted: Dual Weapon Attack | Dual Weapon Attack | 1 |

### Seeker

| Choice path | Feature | Detail |
| --- | --- | --- |
| Seeker's Bond → Bloodbond | Bloodbond | 1 |
| Seeker's Bond → Spiritbond | Spiritbond | 1 |
| Auto-granted: Inevitable Shot | Inevitable Shot | 1 |

### Sentinel (Essentials, parent: Druid)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Combined Attack | Combined Attack | 1 |
| Auto-granted: Healing Word (Druid) | Healing Word (Druid) | 1 |

### Shaman

| Choice path | Feature | Detail |
| --- | --- | --- |
| Companion Spirit → Elemental Spirit | Elemental Spirit | 2 |
| Companion Spirit → Protector Spirit | Protector Spirit | 2 |
| Companion Spirit → Stalker Spirit | Stalker Spirit | 2 |
| Companion Spirit → Watcher Spirit | Watcher Spirit | 2 |
| Companion Spirit → World Speaker Spirit | World Speaker Spirit | 2 |
| Auto-granted: Healing Spirit | Healing Spirit | 1 |
| Auto-granted: Companion Spirit | Companion Spirit | 1 |
| Auto-granted: Speak with Spirits | Speak with Spirits | 1 |

### Skald (Essentials, parent: Bard)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Words of Friendship | Words of Friendship | 1 |
| Auto-granted: Skald's Aura | Skald's Aura | 1 |

### Slayer (Essentials, parent: Fighter)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Power Strike | Power Strike | 1 |

### Swordmage

| Choice path | Feature | Detail |
| --- | --- | --- |
| Swordmage Aegis → Aegis of Assault | Aegis of Assault | 1 |
| Swordmage Aegis → Aegis of Ensnarement | Aegis of Ensnarement | 1 |
| Swordmage Aegis → Aegis of Shielding | Aegis of Shielding | 1 |

### Thief (Essentials, parent: Rogue)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Backstab | Backstab | 1 |

### Vampire

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Vampire At-Will Attack Powers | Vampire At-Will Attack Powers | 3 |
| Auto-granted: Blood Drinker | Blood Drinker | 1 |
| Auto-granted: Swarm of Shadows | Swarm of Shadows | 1 |

### Warden

| Choice path | Feature | Detail |
| --- | --- | --- |
| Auto-granted: Nature's Wrath | Nature's Wrath | 2 |

### Warlock

| Choice path | Feature | Detail |
| --- | --- | --- |
| Eldritch Pact → Dark Pact | Dark Pact | 2 |
| Eldritch Pact → Elemental Pact | Elemental Pact | 2 |
| Eldritch Pact → Fey Pact | Fey Pact | 2 |
| Eldritch Pact → Infernal Pact | Infernal Pact | 1 |
| Eldritch Pact → Sorcerer-King Pact | Sorcerer-King Pact | 1 |
| Eldritch Pact → Star Pact | Star Pact | 2 |
| Eldritch Pact → Vestige Pact | Vestige Pact | 2 |
| Auto-granted: Warlock's Curse | Warlock's Curse | 1 |

### Warlord

| Choice path | Feature | Detail |
| --- | --- | --- |
| Leader → Battlefront Leader | Battlefront Leader | 1 |
| Auto-granted: Inspiring Word | Inspiring Word | 1 |

### Warpriest (Essentials, parent: Cleric)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Domain Features → Corellon Domain Features and Powers | Corellon Domain Features and Powers | 4 |
| Domain Features → Death Domain Features and Powers | Death Domain Features and Powers | 4 |
| Domain Features → Earth Domain Features and Powers | Earth Domain Features and Powers | 4 |
| Domain Features → Oghma Domain Features and Powers | Oghma Domain Features and Powers | 4 |
| Domain Features → Selûne Domain Features and Powers | Selûne Domain Features and Powers | 4 |
| Domain Features → Storm Domain Features and Powers | Storm Domain Features and Powers | 4 |
| Domain Features → Sun Domain Features | Sun Domain Features | 4 |
| Domain Features → Torm Domain Features and Powers | Torm Domain Features and Powers | 4 |
| Auto-granted: Healing Word | Healing Word | 1 |
| Auto-granted: Channel Divinity Powers | Channel Divinity Powers | 1 |

### Witch (Essentials, parent: Wizard)

| Choice path | Feature | Detail |
| --- | --- | --- |
| Moon Coven → Dark Moon Coven | Dark Moon Coven | 1 |
| Moon Coven → Full Moon Coven | Full Moon Coven | 1 |
| Auto-granted: Augury | Augury | 1 |

### Wizard

| Choice path | Feature | Detail |
| --- | --- | --- |
| Arcane Implement Mastery → Orb of Deception | Orb of Deception | 1 |
| Arcane Implement Mastery → Orb of Imposition | Orb of Imposition | 1 |
| Arcane Implement Mastery → Staff of Defense | Staff of Defense | 1 |
| Arcane Implement Mastery → Wand of Accuracy | Wand of Accuracy | 1 |


## P1a — Nested power choice groups

_After picking a parent option, expose a dependent power pick (`classPower:{featureId}` with `visibleWhen`)._

**Status:** Fixed (9b4c41e)

### Warlock

| Choice path | Feature | Detail |
| --- | --- | --- |
| Eldritch Pact → Infernal Pact → power variant | Infernal Pact | classPower:ID_FMP_CLASS_FEATURE_773 |

### Wizard

| Choice path | Feature | Detail |
| --- | --- | --- |
| Arcane Implement Mastery → Tome of Readiness → power variant | Tome of Readiness | classPower:ID_FMP_CLASS_FEATURE_1511 |


## P1b — Nested class-feature choice groups

_After picking a parent option, expose a dependent class-feature pick (`classFeature:{featureId}` with `visibleWhen`)._

**Status:** Fixed (9b4c41e)

### Elementalist (Essentials, parent: Sorcerer)

- **Elemental Specialty → Air Elementalist → Elemental Specialty** (`classFeature:ID_FMP_CLASS_FEATURE_4336`): Howling Zephyr, Static Charge
- **Elemental Specialty → Earth Elementalist → Elemental Specialty** (`classFeature:ID_FMP_CLASS_FEATURE_4337`): Erupting Earth, Seismic Shock
- **Elemental Specialty → Fire Elementalist → Elemental Specialty** (`classFeature:ID_FMP_CLASS_FEATURE_4338`): Blazing Cloud, Ignition
- **Elemental Specialty → Water Elementalist → Elemental Specialty** (`classFeature:ID_FMP_CLASS_FEATURE_4339`): Deluge, Ice Prison

### Rogue

- **Class feature → Sharpshooter Talent → Class Feature** (`classFeature:ID_FMP_CLASS_FEATURE_2238`): Sharpshooter Talent (Crossbow), Sharpshooter Talent (Sling)


## P1c — Class-feature `rules.modify Power`

_Apply compendium power patches (Usage, Display, Keywords, …) on power cards from active class features._

**Status:** Partial (9b4c41e)

### Binder (Essentials, parent: Warlock)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Summon Warlock's Ally (Binder) | Class, Display | 2 |

### Blackguard (Essentials, parent: Paladin)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Extra Dread Smite | Special | 1 |
| Improved Shroud of Shadow (Domination) | Improved Shroud of Shadow | 2 |
| Improved Shroud of Shadow (Fury) | Improved Shroud of Shadow | 2 |
| Level 13 Extra Dread Smite | Special | 1 |
| Shadow Leap | Shadow Leap | 1 |

### Bladesinger (Essentials, parent: Wizard)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Instinctive Attack | Instinctive Attack | 1 |
| Bladesinger Cantrips | Action Type, Class, Power Type, Power Usage | 10 |

### Cleric

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Healing Word | Display, Power Type | 2 |
| Storm Domain Features and Powers | Storm Domain Feature | 1 |
| Sun Domain Features | Sun Domain Feature | 1 |
| Earth Domain Features and Powers | Earth Domain Feature | 1 |
| Death Domain Features and Powers | Death Domain Features and Powers | 3 |
| Corellon Domain Features and Powers | Corellon Domain Features and Powers | 1 |
| Oghma Domain Features and Powers | Oghma Domain Features and Powers | 1 |
| Selûne Domain Features and Powers | Selûne Domain Features and Powers | 1 |
| Torm Domain Features and Powers | Torm Domain Features and Powers | 1 |
| Domination Domain Features and Powers | Domination Domain Feature | 1 |
| Healing Word (Druid) | Class, Display, Power Type, Power Usage | 4 |
| Healing Word (Companion) | Class, Display, Effect, Power Type, Power Usage | 5 |
| Healing Word (Hybrid Sentinel) | Class, Display, Power Type, Power Usage | 4 |

### Druid

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Circle of Renewal | Healing Growth | 1 |
| Circle of Shelter | Unhindering Growth | 1 |
| Healing Word (Hybrid Sentinel) | Class, Display, Power Type, Power Usage | 4 |

### Elementalist (Essentials, parent: Sorcerer)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Air Elementalist | Air Elementalist, Keywords | 2 |
| Earth Elementalist | Earth Elementalist, Keywords | 2 |
| Fire Elementalist | Fire Elementalist, Keywords | 2 |
| Water Elementalist | Keywords, Water Elementalist | 2 |

### Fighter

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Bladed Step | Bladed Step | 1 |
| Staggering Hammer | Staggering Hammer | 1 |
| Brutal Axe | Brutal Axe | 1 |
| Sweeping Sword | Sweeping Sword | 1 |
| Rapid Quarterstaff | Rapid Quarterstaff | 1 |

### Hunter (Essentials, parent: Ranger)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Disruptive Shot | ? | 1 |
| Level 7 Improved Disruptive Shot | ? | 1 |
| Level 13 Improved Disruptive Shot | ? | 1 |

### Hybrid Paladin

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Divine Challenge (Hybrid) | Effect | 1 |

### Hybrid Sentinel

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Healing Word (Hybrid Sentinel) | Class, Display, Power Type, Power Usage | 4 |

### Hybrid Wizard

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Hybrid Cantrips | Action Type, Class, Power Type, Power Usage | 10 |

### Knight (Essentials, parent: Fighter)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Power Strike | ? | 1 |
| Bladed Step | Bladed Step | 1 |
| Staggering Hammer | Staggering Hammer | 1 |
| Level 13 Improved Power Strike | ? | 1 |

### Leader

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Healing Word (Companion) | Class, Display, Effect, Power Type, Power Usage | 5 |

### Mage (Essentials, parent: Wizard)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Mage Cantrips | Action Type, Class, Power Type, Power Usage | 10 |

### Monk

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Centered Breath | _ExtraKeywords | 1 |
| Stone Fist | _ExtraKeywords | 1 |
| Centered Breath (Hybrid) | _ExtraKeywords | 1 |
| Stone Fist (Hybrid) | _ExtraKeywords | 1 |
| Iron Soul | _ExtraKeywords | 1 |
| Iron Soul (Hybrid) | _ExtraKeywords | 1 |
| Desert Wind (Hybrid) | _ExtraKeywords | 1 |
| Eternal Tide (Hybrid) | _ExtraKeywords | 1 |

### Paladin

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Divine Challenge (Hybrid) | Effect | 1 |

### Protector (Essentials, parent: Druid)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Circle of Renewal | Healing Growth | 1 |
| Circle of Shelter | Unhindering Growth | 1 |

### Scout (Essentials, parent: Ranger)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Power Strike | ? | 1 |
| Enhanced Power Strike | ? | 3 |

### Sentinel (Essentials, parent: Druid)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Combined Attack | ? | 1 |
| Level 7 Improved Combined Attack | ? | 1 |
| Paragon of the Natural Cycle (Spring) | Hit | 1 |
| Paragon of the Natural Cycle (Summer) | Hit | 1 |
| Timeless Body | Hit | 2 |
| Healing Word (Druid) | Class, Display, Power Type, Power Usage | 4 |

### Slayer (Essentials, parent: Fighter)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Power Strike | ? | 1 |
| Level 13 Improved Power Strike | ? | 1 |
| Brutal Axe | Brutal Axe | 1 |
| Sweeping Sword | Sweeping Sword | 1 |
| Rapid Quarterstaff | Rapid Quarterstaff | 1 |

### Sorcerer

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Air Elementalist | Air Elementalist, Keywords | 2 |
| Earth Elementalist | Earth Elementalist, Keywords | 2 |
| Fire Elementalist | Fire Elementalist, Keywords | 2 |
| Water Elementalist | Keywords, Water Elementalist | 2 |

### Thief (Essentials, parent: Rogue)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Level 3 Improved Backstab | ? | 1 |
| Level 13 Improved Backstab | ? | 1 |
| Evasive Backstab | Evasive Backstab | 1 |

### Vampire

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Improved Blood Drinker | Special | 1 |
| Energized Blood Drinker | Special | 1 |

### Warlock

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Fey Pact (Binding Initate) | Power Usage | 2 |
| Gloom Pact (Binding Initate) | Power Usage | 2 |
| Star Pact (Binding Initate) | Power Usage | 2 |

### Warpriest (Essentials, parent: Cleric)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Healing Word | Display, Power Type | 2 |
| Storm Domain Features and Powers | Storm Domain Feature | 1 |
| Sun Domain Features | Sun Domain Feature | 1 |
| Earth Domain Features and Powers | Earth Domain Feature | 1 |
| Death Domain Features and Powers | Death Domain Features and Powers | 3 |
| Corellon Domain Features and Powers | Corellon Domain Features and Powers | 1 |
| Oghma Domain Features and Powers | Oghma Domain Features and Powers | 1 |
| Selûne Domain Features and Powers | Selûne Domain Features and Powers | 1 |
| Torm Domain Features and Powers | Torm Domain Features and Powers | 1 |
| Domination Domain Features and Powers | Domination Domain Feature | 1 |
| Healing Word (Druid) | Class, Display, Power Type, Power Usage | 4 |
| Healing Word (Companion) | Class, Display, Effect, Power Type, Power Usage | 5 |
| Healing Word (Hybrid Sentinel) | Class, Display, Power Type, Power Usage | 4 |

### Witch (Essentials, parent: Wizard)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Witch Cantrips | Action Type, Class, Power Type, Power Usage | 10 |

### Wizard

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Arcanist Cantrips | Action Type, Class, Power Type, Power Usage | 10 |
| Mage Cantrips | Action Type, Class, Power Type, Power Usage | 10 |
| Bladesinger Cantrips | Action Type, Class, Power Type, Power Usage | 10 |
| Witch Cantrips | Action Type, Class, Power Type, Power Usage | 10 |


## P1d — Class-feature `rules.modify Weapon` (class-mapped)

_Weapon key ability, damage die, off-hand/load properties — only features with explicit `Class` in compendium._

**Status:** Open

### Druid

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Druid of Summer | Damage | 8 |

### Rogue

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Rogue Weapon Talent | Damage | 2 |

### Sentinel (Essentials, parent: Druid)

| Feature | Modify fields | Rules |
| --- | --- | --- |
| Druid of Summer | Damage | 8 |


## P1e — Essentials build suggested powers

_Pre-fill empty PHB power slots when player selects an `ID_FMP_BUILD_*` Essentials build._

**Status:** Fixed (9b4c41e)

### Ardent

| Build | Suggested powers |
| --- | --- |
| Enlightened Ardent | 3 |
| Euphoric Ardent | 3 |
| Impetuous Ardent | 3 |

### Artificer

| Build | Suggested powers |
| --- | --- |
| Battlesmith Artificer | 4 |
| Tinkerer Artificer | 4 |
| Warrior Forge Artificer | 3 |

### Avenger

| Build | Suggested powers |
| --- | --- |
| Isolating Avenger | 7 |
| Pursuing Avenger | 8 |

### Barbarian

| Build | Suggested powers |
| --- | --- |
| Rageblood Barbarian | 5 |
| Thunderborn Barbarian | 1 |
| Whirling Barbarian | 1 |

### Bard

| Build | Suggested powers |
| --- | --- |
| Cunning Bard | 6 |
| Prescient Bard | 4 |
| Valorous Bard | 20 |

### Battlemind

| Build | Suggested powers |
| --- | --- |
| Harrier Battlemind | 3 |
| Quick Battlemind | 4 |
| Resilient Battlemind | 3 |
| Wild Battlemind | 3 |

### Cleric

| Build | Suggested powers |
| --- | --- |
| Battle Cleric | 15 |
| Devoted Cleric | 19 |

### Druid

| Build | Suggested powers |
| --- | --- |
| Guardian Druid | 2 |
| Predator Druid | 2 |

### Fighter

| Build | Suggested powers |
| --- | --- |
| Arena Fighter | 3 |
| Battlerager Fighter | 4 |
| Brawling Fighter | 4 |
| Great Weapon Fighter | 14 |
| Guardian Fighter | 13 |
| Tempest Fighter | 4 |

### Invoker

| Build | Suggested powers |
| --- | --- |
| Preserving Invoker | 6 |
| Wrathful Invoker | 6 |

### Monk

| Build | Suggested powers |
| --- | --- |
| Centered Breath Monk | 4 |
| Iron Soul Monk | 4 |
| Stone Fist Monk | 4 |

### Paladin

| Build | Suggested powers |
| --- | --- |
| Avenging Paladin | 13 |
| Protecting Paladin | 15 |

### Psion

| Build | Suggested powers |
| --- | --- |
| Shaper Psion | 3 |
| Telekinetic Psion | 3 |
| Telepathic Psion | 3 |

### Ranger

| Build | Suggested powers |
| --- | --- |
| Archer Ranger | 15 |
| Beastmaster Ranger | 4 |
| Hunter Ranger | 3 |
| Marauder Ranger | 4 |
| Two-Blade Ranger | 14 |

### Rogue

| Build | Suggested powers |
| --- | --- |
| Aerialist Rogue | 2 |
| Brawny Rogue | 14 |
| Cutthroat Rogue | 3 |
| Shadowy Rogue | 3 |
| Trickster Rogue | 16 |

### Runepriest

| Build | Suggested powers |
| --- | --- |
| Defiant Runepriest | 4 |
| Wrathful Runepriest | 4 |

### Seeker

| Build | Suggested powers |
| --- | --- |
| Protecting Seeker | 3 |
| Vengeful Seeker | 3 |

### Shaman

| Build | Suggested powers |
| --- | --- |
| Animist Shaman | 4 |
| Bear Shaman | 6 |
| Panther Shaman | 7 |

### Sorcerer

| Build | Suggested powers |
| --- | --- |
| Chaos Sorcerer | 14 |
| Cosmic Sorcerer | 7 |
| Dragon Sorcerer | 19 |
| Storm Sorcerer | 4 |

### Swordmage

| Build | Suggested powers |
| --- | --- |
| Assault Swordmage | 22 |
| Ensnaring Swordmage | 8 |
| Shielding Swordmage | 19 |

### Warden

| Build | Suggested powers |
| --- | --- |
| Earth Warden | 5 |
| Wild Warden | 4 |

### Warlock

| Build | Suggested powers |
| --- | --- |
| Deceptive Warlock | 31 |
| Scourge Warlock | 18 |
| Sorcerer-King Pact | 3 |

### Warlord

| Build | Suggested powers |
| --- | --- |
| Bravura Warlord | 11 |
| Insightful Warlord | 4 |
| Inspiring Warlord | 17 |
| Resourceful Warlord | 19 |
| Skirmishing Warlord | 4 |
| Tactical Warlord | 15 |

### Wizard

| Build | Suggested powers |
| --- | --- |
| Control Wizard | 24 |
| Illusionist Wizard | 4 |
| Summoner Wizard | 4 |
| War Wizard | 23 |


## P1f — Class-feature `rules.replace`

_Swap granted powers at higher levels (pact upgrades, Warpriest dailies, etc.)._

**Status:** Open

### Binder (Essentials, parent: Warlock)

| Feature | Replace rules |
| --- | --- |
| Level 15 Binder Daily Power | 1 |
| Level 19 Binder Daily Power | 1 |
| Level 29 Binder Daily Power | 1 |

### Blackguard (Essentials, parent: Paladin)

| Feature | Replace rules |
| --- | --- |
| Level 19 Blackguard Daily Power | 1 |
| Level 25 Blackguard Daily Power | 1 |
| Avatar of Vice | 1 |

### Cleric

| Feature | Replace rules |
| --- | --- |
| Level 15 Warpriest Daily Power | 1 |
| Level 19 Warpriest Daily Power | 1 |
| Level 25 Warpriest Daily Power | 1 |
| Level 29 Warpriest Daily Power | 1 |

### Paladin

| Feature | Replace rules |
| --- | --- |
| Level 19 Blackguard Daily Power | 1 |
| Level 25 Blackguard Daily Power | 1 |
| Avatar of Vice | 1 |

### Sentinel (Essentials, parent: Druid)

| Feature | Replace rules |
| --- | --- |
| Level 15 Sentinel Daily Power | 1 |
| Level 19 Sentinel Daily Power | 1 |
| Level 25 Sentinel Daily Power | 1 |
| Level 29 Sentinel Daily Power | 1 |

### Warlock

| Feature | Replace rules |
| --- | --- |
| Level 13 Gloom Pact Encounter Power | 1 |
| Level 13 Star Pact Encounter Power | 1 |
| Level 13 Fey Pact Encounter Power | 1 |
| Level 15 Binder Daily Power | 1 |
| Level 17 Gloom Pact Encounter Power | 1 |
| Level 17 Star Pact Encounter Power | 1 |
| Level 17 Fey Pact Encounter Power | 1 |
| Level 19 Binder Daily Power | 1 |
| Level 23 Gloom Pact Encounter Power | 1 |
| Level 23 Star Pact Encounter Power | 1 |
| Level 23 Fey Pact Encounter Power | 1 |
| Level 27 Gloom Pact Encounter Power | 1 |
| Level 27 Star Pact Encounter Power | 1 |
| Level 27 Fey Pact Encounter Power | 1 |
| Level 29 Binder Daily Power | 1 |

### Warpriest (Essentials, parent: Cleric)

| Feature | Replace rules |
| --- | --- |
| Level 15 Warpriest Daily Power | 1 |
| Level 19 Warpriest Daily Power | 1 |
| Level 25 Warpriest Daily Power | 1 |
| Level 29 Warpriest Daily Power | 1 |


## P0 — Theme / path power level resolution

_Powers whose level lives on the parent theme feature (not the power row) must appear on Theme tab and power lists._

**Status:** Fixed (`5609f82`)

**Example:** Bloodsworn → Bloodied Determination (`ID_FMP_POWER_16429`, level from parent feature `ID_FMP_CLASS_FEATURE_4469`).

**Affected:** All theme, paragon path, and epic destiny features with `rules.grant type=Power` where the power row lacks `Level`.


## P1d — Unmapped weapon modify features

_127 compendium class features have `rules.modify type=Weapon`; 124 lack a `Class` field and are internal weapon definition rows._

### Arena Training (Fighter build — internal weapon rows) (95 features)

- Sample: Arena Weapon (Club), Arena Weapon (Dagger), … (95 total)
- Fields modified: Group

### Other internal / unscoped weapon modify (30 features)

- Sample: Rogue Weapon Talent, Honor the Bow, … (30 total)
- Fields modified: Damage, _ImplementEquiv, _ImplementForPower

### Crossbow Savant / internal weapon rows (1 features)

- Crossbow Savant (Item Slot, Properties)

### Bow Implement (Ranger) (1 features)

- Bow Implement (_ImplementForPower)


## Appendix: Indexed choice groups by class

_Existing L1 `classFeatureChoiceGroupsByClassId` before runtime nested append._

### Ardent

- **Ardent Mantle** — pick 1: Mantle of Clarity, Mantle of Elation, Mantle of Impulsiveness

### Artificer

- **Healing Infusion** — power pick 1 (pool 2)

### Assassin

- **Guild Training** — pick 1: Bleak Disciple, Executioner's Guild, Night Stalker
- **Shade Form** — pick 1: Standard (default class proficiencies), Shade Form

### Avenger

- **Avenger's Censure** — pick 1: Censure of Pursuit, Censure of Retribution, Censure of Unity
- **Channel Divinity** — power pick 2 (pool 12)

### Barbarian

- **Feral Might** — pick 1: Rageblood Vigor, Thaneborn Triumph, Thunderborn Wrath, Whirling Slayer

### Bard

- **Bardic Virtue** — pick 1: Virtue of Cunning, Virtue of Prescience, Virtue of Valor
- **Signs of Influence** — pick 1: No Signs of Influence, Signs of Influence
- **Signs of Influence** — pick 2: Attract Attendants, Demand Audience, Ritual Beneficiary, Travel in Style, Welcome Guest _(visible when classFeatureOptional:ID_FMP_CLASS_FEATURE_4139 = option)_
- **Signs of Influence (level 13)** — pick 1: Attract Attendants, Demand Audience, Ritual Beneficiary, Travel in Style, Welcome Guest _(visible when classFeatureOptional:ID_FMP_CLASS_FEATURE_4139 = option)_
- **Signs of Influence (level 17)** — pick 1: Attract Attendants, Demand Audience, Ritual Beneficiary, Travel in Style, Welcome Guest _(visible when classFeatureOptional:ID_FMP_CLASS_FEATURE_4139 = option)_

### Battlemind

- **Psionic Study** — pick 1: Battle Resilience, Persistent Harrier, Speed of Thought, Wild Focus

### Berserker (Essentials, parent: Barbarian)

- **Defender Aura** — pick 1: Standard (default class proficiencies), Defender Aura
- **Heartland** — pick 1: Arid Desert, Frozen Land, Temperate Land

### Binder (Essentials, parent: Warlock)

- **Level 1 Binder Daily Power** — power pick 1 (pool 25)
- **Pact Boon (Binder)** — pick 1: Fey Pact Boon (Binder), Gloom Pact Boon (Binder), Star Pact Boon (Binder)
- **Level 2 Binder Utility Power** — power pick 1 (pool 18)
- **Level 5 Binder Daily Power** — power pick 1 (pool 25)
- **Level 6 Binder Utility Power** — power pick 1 (pool 20)
- **Level 10 Binder Utility Power** — power pick 1 (pool 21)
- **Level 16 Binder Utility Power** — power pick 1 (pool 18)

### Blackguard (Essentials, parent: Paladin)

- **Spirit of Vice** — pick 1: Spirit of Vice (Domination), Spirit of Vice (Fury)
- **Level 5 Blackguard Daily Power** — power pick 1 (pool 13)
- **Level 6 Blackguard Utility Power** — power pick 1 (pool 14)
- **Level 9 Blackguard Daily Power** — power pick 1 (pool 16)
- **Level 10 Blackguard Utility Power** — power pick 1 (pool 14)
- **Level 15 Blackguard Daily Power** — power pick 1 (pool 14)
- **Level 16 Blackguard Utility Power** — power pick 1 (pool 11)

### Bladesinger (Essentials, parent: Wizard)

- **Bladesinger Cantrips** — power pick 3 (pool 10)
- **Bladespells** — power pick 3 (pool 6)
- **Level 1 Bladesinger Daily Powers** — power pick 2 (pool 19)
- **Level 1 Bladesinger Daily Powers** — power pick 2 (pool 19)
- **Level 2 Bladesinger Utility Powers** — power pick 2 (pool 23)
- **Level 5 Bladesinger Daily Powers** — power pick 2 (pool 18)
- **Level 6 Bladesinger Utility Powers** — power pick 2 (pool 23)
- **Level 9 Bladesinger Daily Powers** — power pick 2 (pool 19)
- **Level 10 Bladesinger Utility Powers** — power pick 2 (pool 22)
- **Level 15 Bladesinger Daily Powers** — power pick 2 (pool 18)
- **Level 16 Bladesinger Utility Powers** — power pick 2 (pool 20)
- **Level 19 Bladesinger Daily Powers** — power pick 2 (pool 18)
- **Level 22 Bladesinger Utility Powers** — power pick 2 (pool 17)
- **Level 25 Bladesinger Daily Powers** — power pick 2 (pool 16)
- **Level 29 Bladesinger Daily Powers** — power pick 2 (pool 16)

### Cavalier (Essentials, parent: Paladin)

- **Spirit of Virtue** — pick 1: Spirit of Sacrifice, Spirit of Valor
- **Virtue At-Will Power** — pick 1: Sacrifice At-Will Power, Valor At-Will Power

### Cleric

- **Channel Divinity** — power pick 2 (pool 2)
- **Channel Divinity** — power pick 2 (pool 3)
- **Healer's Lore** — pick 1: Standard (default class proficiencies), Healer's Lore

### Druid

- **Primal Aspect** — pick 1: Primal Guardian, Primal Predator, Primal Swarm, Primal Wrath

### Elementalist (Essentials, parent: Sorcerer)

- **Elemental Specialty** — pick 1: Air Elementalist, Earth Elementalist, Fire Elementalist, Water Elementalist
- **Elemental Magic** — power pick 2 (pool 10)
- **Elemental Magic** — power pick 2 (pool 10)

### Executioner (Essentials, parent: Assassin)

- **Attack Finesse (Executioner)** — pick 1: Standard (default class proficiencies), Attack Finesse (Executioner)
- **Guild Attacks** — pick 1: League of Whispers, Red Scales, Way of the Ninja
- **Versatile Defense** — pick 1: Executioner Shield Proficiency, Executioner Two-Weapon Defense
- **Level 2 Executioner Utility Power** — power pick 1 (pool 10)
- **Level 6 Executioner Utility Power** — power pick 1 (pool 9)
- **Level 10 Executioner Utility Power** — power pick 1 (pool 10)

### Fighter

- **Class feature** — pick 1: Combat Agility, Combat Superiority
- **Fighter Talents** — pick 1: Arena Training, Battlerager Vigor, Brawler Style, One-handed Weapon Talent, Tempest Technique, Two-handed Weapon Talent

### Hexblade (Essentials, parent: Warlock)

- **Level 1 Hexblade Daily Power** — power pick 1 (pool 25)
- **Pact Boon** — pick 1: Elemental Pact Boon, Fey Pact Boon, Fey Pact of the White Well Boon, Gloom Pact Boon (Hexblade), Infernal Pact Boon, Star Pact Boon
- **Pact Reward** — pick 1: Elemental Pact Reward, Fey Pact of the White Well Reward, Fey Pact Reward, Gloom Pact Reward, Infernal Pact Reward, Star Pact Reward
- **Pact Weapon** — pick 1: Elemental Pact Weapon, Fey Pact of the White Well Weapon, Fey Pact Weapon, Gloom Pact Weapon, Infernal Pact Weapon, Star Pact Weapon

### Hunter (Essentials, parent: Ranger)

- **Archery Style** — pick 1: Bow Hunter, Crossbow Hunter
- **Aspects of the Wild (Hunter)** — power pick 2 (pool 8)
- **Ranger Wilderness Knacks** — pick 2: Ambush Expertise, Beast Empathy, Mountain Guide, Watchful Rest, Wilderness Tracker
- **Level 2 Hunter Utility Power** — power pick 1 (pool 29)
- **Level 6 Hunter Utility Power** — power pick 1 (pool 20)
- **Level 7 Aspect of the Wild (Hunter)** — power pick 1 (pool 3)
- **Level 10 Hunter Utility Power** — power pick 1 (pool 18)
- **Level 16 Hunter Utility Power** — power pick 1 (pool 20)
- **Level 17 Aspect of the Wild (Hunter)** — power pick 1 (pool 3)
- **Level 22 Hunter Utility Power** — power pick 1 (pool 20)

### Invoker

- **Channel Divinity** — power pick 2 (pool 12)
- **Divine Covenant** — pick 1: Covenant of Malediction, Covenant of Preservation, Covenant of Wrath

### Knight (Essentials, parent: Fighter)

- **Battle Guardian** — power pick 1 (pool 2)
- **Class feature** — pick 1: Shield Finesse, Spinning Deflection
- **Knight Fighter Stances** — power pick 2 (pool 6)
- **Level 2 Knight Utility Power** — power pick 1 (pool 27)
- **Level 6 Knight Utility Power** — power pick 1 (pool 26)
- **Knight Weapon Specialization** — pick 1: Bladed Step, Bludgeoning Staff, Staggering Hammer
- **Level 7 Extra Knight Stance** — power pick 1 (pool 6)
- **Level 10 Knight Utility Power** — power pick 1 (pool 27)
- **Level 17 Extra Knight Stance** — power pick 1 (pool 6)

### Mage (Essentials, parent: Wizard)

- **Level 1 Apprentice Mage** — pick 1: Enchantment Apprentice, Evocation Apprentice, Illusion Apprentice, Necromancy Apprentice, Nethermancy Apprentice, Pyromancy Apprentice
- **Level 1 Mage Daily Powers** — power pick 2 (pool 21)
- **Level 1 Mage Daily Powers** — power pick 2 (pool 21)
- **Level 1 Mage Encounter Powers** — power pick 2 (pool 19)
- **Level 1 Mage Encounter Powers** — power pick 2 (pool 19)
- **Mage Cantrips** — power pick 3 (pool 10)
- **Level 2 Mage Utility Powers** — power pick 2 (pool 23)
- **Level 3 Mage Encounter Powers** — power pick 2 (pool 18)
- **Level 4 Apprentice Mage** — pick 1: Enchantment Apprentice, Evocation Apprentice, Illusion Apprentice, Necromancy Apprentice, Nethermancy Apprentice, Pyromancy Apprentice
- **Level 5 Expert Mage** — pick 1: Enchantment Expert, Evocation Expert, Illusion Expert, Necromancy Expert, Nethermancy Expert, Pyromancy Expert
- **Level 5 Mage Daily Powers** — power pick 2 (pool 20)
- **Level 6 Mage Utility Powers** — power pick 2 (pool 23)
- **Level 7 Mage Encounter Powers** — power pick 2 (pool 19)
- **Level 8 Expert Mage** — pick 1: Enchantment Expert, Evocation Expert, Illusion Expert, Necromancy Expert, Nethermancy Expert, Pyromancy Expert
- **Level 9 Mage Daily Powers** — power pick 2 (pool 23)
- **Level 10 Mage Utility Powers** — power pick 2 (pool 22)
- **Master Mage** — pick 1: Enchantment Master, Evocation Master, Illusion Master, Necromancy Master, Nethermancy Master, Pyromancy Master
- **Level 13 Mage Encounter Powers** — power pick 2 (pool 18)
- **Level 15 Mage Daily Powers** — power pick 2 (pool 24)
- **Level 16 Mage Utility Powers** — power pick 2 (pool 20)
- **Level 17 Mage Encounter Powers** — power pick 2 (pool 18)
- **Level 19 Mage Daily Powers** — power pick 2 (pool 19)
- **Level 22 Mage Utility Powers** — power pick 2 (pool 17)
- **Level 23 Mage Encounter Powers** — power pick 2 (pool 16)
- **Level 25 Mage Daily Powers** — power pick 2 (pool 19)
- **Level 27 Mage Encounter Powers** — power pick 2 (pool 16)
- **Level 29 Mage Daily Powers** — power pick 2 (pool 16)

### Monk

- **Monastic Tradition** — pick 1: Centered Breath, Desert Wind, Eternal Tide, Iron Soul, Stone Fist

### Paladin

- **Channel Divinity** — power pick 2 (pool 12)
- **Lay on Hands** — power pick 1 (pool 3)

### Protector (Essentials, parent: Druid)

- **Balance of Nature** — pick 1: Standard (default class proficiencies), Balance of Nature
- **Druid Circle** — pick 1: Circle of Renewal, Circle of Shelter
- **Primal Attunement** — power pick 3 (pool 5)

### Psion

- **Discipline Focus** — pick 1: Shaper Focus, Telekinesis Focus, Telepathy Focus

### Ranger

- **Class feature** — pick 1: Prime Shot, Running Attack
- **Fighting Style** — pick 1: Archer Fighting Style, Beast Mastery, Hunter Fighting Style, Marauder Fighting Style, Two-Blade Fighting Style

### Rogue

- **Class feature** — pick 1: Rogue Weapon Talent, Sharpshooter Talent
- **Rogue Tactics** — pick 1: Artful Dodger, Brutal Scoundrel, Cunning Sneak, Ruthless Ruffian
- **Sharpshooter Talent** — pick 1: Sharpshooter Talent (Crossbow), Sharpshooter Talent (Sling) _(visible when classFeaturePair:ID_FMP_CLASS_FEATURE_2238:ID_FMP_CLASS_FEATURE_391 = option)_

### Runepriest

- **Runic Artistry** — pick 1: Defiant Word, Serene Blade, Wrathful Hammer

### Scout (Essentials, parent: Ranger)

- **Aspects of the Wild (Scout)** — power pick 2 (pool 8)
- **Ranger Wilderness Knacks** — pick 2: Ambush Expertise, Beast Empathy, Mountain Guide, Watchful Rest, Wilderness Tracker
- **Two-Weapon Style** — pick 1: Flashing Blade Mastery, Spinning Axe Mastery
- **Level 2 Scout Utility Power** — power pick 1 (pool 29)
- **Level 6 Scout Utility Power** — power pick 1 (pool 20)
- **Level 7 Aspect of the Wild (Scout)** — power pick 1 (pool 3)
- **Level 10 Scout Utility Power** — power pick 1 (pool 18)
- **Level 16 Scout Utility Power** — power pick 1 (pool 20)
- **Level 22 Scout Utility Power** — power pick 1 (pool 20)

### Seeker

- **Seeker's Bond** — pick 1: Bloodbond, Spiritbond

### Sentinel (Essentials, parent: Druid)

- **Druid Wilderness Knacks** — pick 2: Beast Empathy, Herb Lore, Mountain Guide, Watchful Rest, Wilderness Tracker
- **Level 1 Sentinel At-Will Power** — power pick 1 (pool 3)
- **Level 1 Sentinel Daily Power** — power pick 1 (pool 18)
- **Season Choice** — pick 1: Druid of Spring, Druid of Summer
- **Level 2 Sentinel Utility Power** — power pick 1 (pool 17)
- **Level 5 Sentinel Daily Power** — power pick 1 (pool 18)
- **Level 6 Sentinel Utility Power** — power pick 1 (pool 18)
- **Level 9 Sentinel Daily Power** — power pick 1 (pool 19)
- **Level 10 Sentinel Utility Power** — power pick 1 (pool 15)
- **Level 16 Sentinel Utility Power** — power pick 1 (pool 13)
- **Level 22 Sentinel Utility Power** — power pick 1 (pool 13)

### Sha'ir (Essentials, parent: Wizard)

- **Sha'ir Cantrips** — power pick 4 (pool 10)

### Shaman

- **Companion Spirit** — pick 1: Elemental Spirit, Protector Spirit, Stalker Spirit, Watcher Spirit, World Speaker Spirit

### Skald (Essentials, parent: Bard)

- **Master of Story and Song** — power pick 5 (pool 14)
- **Master of Story and Song** — power pick 5 (pool 15)
- **Master of Story and Song** — power pick 5 (pool 13)
- **Master of Story and Song** — power pick 5 (pool 10)
- **Master of Story and Song** — power pick 5 (pool 10)

### Slayer (Essentials, parent: Fighter)

- **Slayer Fighter Stances** — power pick 2 (pool 6)
- **Level 2 Slayer Utility Power** — power pick 1 (pool 27)
- **Level 6 Slayer Utility Power** — power pick 1 (pool 26)
- **Level 7 Extra Slayer Stance** — power pick 1 (pool 6)
- **Slayer Weapon Specialization** — pick 1: Brutal Axe, Rapid Quarterstaff, Sweeping Sword
- **Level 10 Slayer Utility Power** — power pick 1 (pool 27)
- **Level 17 Extra Slayer Stance** — power pick 1 (pool 6)

### Sorcerer

- **Spell Source** — pick 1: Cosmic Magic, Dragon Magic, Storm Magic, Wild Magic

### Swordmage

- **Swordmage Aegis** — pick 1: Aegis of Assault, Aegis of Ensnarement, Aegis of Shielding

### Thief (Essentials, parent: Rogue)

- **Rogue's Trick** — power pick 2 (pool 9)
- **Level 2 Thief Utility Power** — power pick 1 (pool 18)
- **Level 4 Extra Rogue's Trick** — power pick 1 (pool 9)
- **Level 6 Thief Utility Power** — power pick 1 (pool 17)
- **Level 7 Extra Rogue's Trick** — power pick 1 (pool 9)
- **Level 10 Thief Utility Power** — power pick 1 (pool 15)
- **Level 17 Extra Rogue's Trick** — power pick 1 (pool 9)

### Vampire

- **Level 2 Vampire Utility Power** — power pick 1 (pool 2)
- **Level 22 Vampire Utility Power** — power pick 1 (pool 2)

### Warden

- **Guardian Might** — pick 1: Earthstrength, Lifespirit, Stormheart, Wildblood

### Warlock

- **Eldritch Blast** — power pick 1 (pool 2)
- **Eldritch Pact** — pick 1: Dark Pact, Elemental Pact, Fey Pact, Infernal Pact, Sorcerer-King Pact, Star Pact, Vestige Pact

### Warlord

- **Archer Warlord** — pick 1: Standard (default class proficiencies), Archer Warlord
- **Archer Warlord Optional Choice** — pick 1: Archer Warlord, Standard Warlord Armor Features
- **Commanding Presence** — pick 1: Bravura Presence, Insightful Presence, Inspiring Presence, Resourceful Presence, Skirmishing Presence, Tactical Presence
- **Leader** — pick 1: Battlefront Leader, Canny Leader, Combat Leader

### Warpriest (Essentials, parent: Cleric)

- **Domain Features** — pick 1: Corellon Domain Features and Powers, Death Domain Features and Powers, Domination Domain Features and Powers, Earth Domain Features and Powers, Oghma Domain Features and Powers, Selûne Domain Features and Powers, Storm Domain Features and Powers, Sun Domain Features, Torm Domain Features and Powers
- **Level 1 Warpriest Daily Power** — power pick 1 (pool 17)
- **Level 2 Warpriest Utility Power** — power pick 1 (pool 15)
- **Level 5 Warpriest Daily Power** — power pick 1 (pool 15)
- **Level 6 Warpriest Utility Power** — power pick 1 (pool 16)
- **Level 9 Warpriest Daily Power** — power pick 1 (pool 14)
- **Level 10 Warpriest Utility Power** — power pick 1 (pool 17)
- **Level 16 Warpriest Utility Power** — power pick 1 (pool 13)
- **Level 22 Warpriest Utility Power** — power pick 1 (pool 15)

### Witch (Essentials, parent: Wizard)

- **Moon Coven** — pick 1: Dark Moon Coven, Full Moon Coven
- **Witch Cantrips** — power pick 3 (pool 10)

### Wizard

- **Arcane Implement Mastery** — pick 1: Orb of Deception, Orb of Imposition, Staff of Defense, Tome of Binding, Tome of Readiness, Wand of Accuracy
- **Arcanist Cantrips** — power pick 4 (pool 10)
- **Spellbook** — power pick 2 (pool 21)
- **Spellbook** — power pick 2 (pool 23)
- **Spellbook** — power pick 2 (pool 20)
- **Spellbook** — power pick 2 (pool 23)
- **Spellbook** — power pick 2 (pool 23)
- **Spellbook** — power pick 2 (pool 22)
- **Spellbook** — power pick 2 (pool 24)
- **Spellbook** — power pick 2 (pool 20)
- **Spellbook** — power pick 2 (pool 19)
- **Spellbook** — power pick 2 (pool 17)
- **Spellbook** — power pick 2 (pool 19)
- **Spellbook** — power pick 2 (pool 16)

