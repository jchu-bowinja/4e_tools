# Equipment system redesign

Status: **Implemented** (2026-05). See [Implementation phases](#implementation-phases) below.

This document defines how the character builder and sheet should handle equippable gear: one flow per slot that combines mundane base items, optional compendium magic effects, and a separate enhancement (“plus”) level.

## Goals

- **Unified UX**: Per slot, the user picks base gear → optional magic enchantment → enhancement level. No parallel “mundane dropdown” and “magic dropdown” lists.
- **CB-aligned rules**: Stats follow 4e enhancement and magic-item rules as far as compendium data allows.
- **Compendium fidelity**: Enchantments are **specific** `Magic Item` rows (e.g. Black Iron Armor) with their properties, powers, and non-enhancement `statAdds`.
- **Explicit enhancement**: The “plus” is always a user-chosen **+0 … +6** applied to the **base** item’s attack/AC (not inferred only from the magic row’s name).

## Slots

| Slot key     | Mundane base (index)     | Magic filter                         | Notes |
|-------------|---------------------------|--------------------------------------|-------|
| `armor`     | `armors` (non-shield)     | `Magic Item Type: Armor`, armor types  | Body armor |
| `shield`    | `armors` (shield)         | `_IsEnchant: Shield` (CB arms-slot rows) + rare `Armor` rows with shield categories | Same 3-step flow as body armor |
| `mainHand`  | `weapons`                 | `Magic Item Type: Weapon`, weapon types | |
| `offHand`   | `weapons`                 | Same as main hand                    | |
| `implement` | `implements` (Superior Implement) | Implement magic items (staff, orb, rod, …) | **Extra** superior-implement layer (see below) |
| `neck`      | *(none)*                  | Neck slot / neck magic item type     | No mundane base in catalog; magic + plus only |

## Per-slot UI flow

```
1. Base item     → mundane catalog entry (required for armor / weapons / implement superior implement)
2. Enchantment   → default: None (mundane only)
                 → optional: one Magic Item row (full effect: property, power, statAdds)
3. Plus          → enhancement 0–6 (integer), applied per 4e rules for that slot kind
```

**Implement slot** (four conceptual layers, three visible steps):

1. **Superior implement** — pick from `Superior Implement` compendium (`implements` in `rules_index.json`). This is the mundane implement layer.
2. **Enchantment** — optional `Magic Item` implement (holy symbol, staff, orb, rod, wand, ki focus, totem). Default **None**. Exclude magic rows whose only role duplicates the superior-implement pick when CB treats them separately.
3. **Plus** — enhancement **+0 … +6** for implement attack (and any implement-specific enhancement rules we support).

Order in the UI should match the table above (superior implement → enchantment → plus).

**Neck slot**:

1. Base — fixed “none” (no selector).
2. Enchantment — optional neck magic item; default None.
3. Plus — enhancement **+0 … +6** (typically applies to neck-slot NAD / enhancement per item rules).

**Persistence**: Always store `equipment.neck` as `{ "enhancement": 0 }` when empty (no enchantment), so the slot has a stable shape. Add `enchantmentId` only when a neck item is selected.

## Rules: how stats combine

Reference: PHB / CB — enhancement bonus on weapons/implement adds to attack and damage; on armor adds to AC; neck items often add enhancement to NAD.

### Layer 1 — Base (mundane)

From `Armor` / `Weapon` / `Implement` (superior implement):

- Armor: armor bonus, check penalty, speed penalty, category (for proficiency).
- Weapon: proficiency bonus, damage, category, group, properties.
- Superior implement: implement group, properties (for proficiency and display).

### Layer 2 — Enhancement (plus, user-selected)

Authoritative **enhancement bonus** for the slot:

| Slot kind   | +N applies to |
|------------|----------------|
| Armor      | AC (armor enhancement) |
| Shield     | AC (shield enhancement; same stacking family as armor in CB) |
| Weapon     | Attack rolls and damage rolls |
| Implement  | Implement attack rolls (and damage where applicable) |
| Neck       | NAD enhancement from neck items (Fortitude / Reflex / Will / AC as per item `statAdds` and CB) |

`+0` means no enhancement bonus from this layer (mundane or magic item only).

### Layer 3 — Magic enchantment (compendium row)

When `enchantmentId` is set:

- **Include**: `property`, `power`, `critical`, flavor, display text; `statAdds` that are **not** replacing the user’s enhancement (see below).
- **Exclude from numeric stacking**: compendium `enhancementBonus` and `statAdds` whose `name`/`type` are purely enhancement duplicates (`Armor Class` + Enhancement, `Armor Enhancement Bonus`, weapon “damage rolls” enhancement lines, etc.) when the user’s **plus** layer is authoritative.

When `enchantmentId` is **None**: no magic properties/powers; only base + plus.

### Default plus when enchantment changes

When the user selects an enchantment, set `enhancement` to that row’s compendium value:

- Use `magicItem.enhancementBonus` from ETL when present.
- If the row has no parsed bonus, parse the minimum **+N** from `enhancement` text and enhancement-related `statAdds` on that row (treat as “lowest” enhancement signal for that single compendium entry).
- User may change plus afterward; the default is a starting point only.

### Compatibility filters (retained)

- **Armor / weapon type matching**: Magic armor only if `armorTypes` matches selected mundane armor (when types are listed). Magic weapon only if `weaponTypes` matches selected weapon group/category.
- **Shield**: Compendium shield property enchants use `_IsEnchant: Shield` with `Magic Item Type: Arms Slot Item` (not `Armor`). Filter by `isEnchant` / `isShieldMagicItem`, plus `armorTypes` matching for the few armor-type shield rows (e.g. Turathi).
- **No character level filter** on magic options (explicit product decision; differs from CB loot tables but simplifies building test characters).

### Validation (proficiency, etc.)

Unchanged in spirit: class/hybrid proficiency still checked against **mundane** base armor/weapon/implement, not against magic item names.

### Warnings (non-blocking)

- **Duplicate enchantment**: If `mainHand.enchantmentId` and `offHand.enchantmentId` are both set and equal, show a builder/sheet **warning** (same magic item on both hands is unusual; still allowed).

## Proposed data model

Replace flat `armorId`, `shieldId`, `mainWeaponId`, `offHandWeaponId`, `implementId`, and `magicItemIds` with a single `equipment` object.

### TypeScript shape

```typescript
/** Enhancement bonus chosen for this slot (+0 = none). */
export type EnhancementLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Standard slot: mundane base + optional magic + plus. */
export interface EquipmentSlotSelection {
  /** Compendium id: Armor, Weapon, or (for implement) Superior Implement. */
  baseId?: string;
  /** Magic Item id; omit or undefined = mundane only. */
  enchantmentId?: string;
  /** Enhancement on top of base; default 0. */
  enhancement?: EnhancementLevel;
}

/** Implement: superior implement + optional magic implement + plus. */
export interface ImplementSlotSelection {
  /** Superior Implement id (`implements` in index). */
  superiorImplementId?: string;
  enchantmentId?: string;
  enhancement?: EnhancementLevel;
}

/** Neck: no mundane base. */
export interface NeckSlotSelection {
  enchantmentId?: string;
  enhancement?: EnhancementLevel;
}

export interface CharacterEquipment {
  armor?: EquipmentSlotSelection;
  shield?: EquipmentSlotSelection;
  mainHand?: EquipmentSlotSelection;
  offHand?: EquipmentSlotSelection;
  implement?: ImplementSlotSelection;
  neck?: NeckSlotSelection;
}

// On CharacterBuild:
equipment?: CharacterEquipment;
```

### Example JSON (saved character)

```json
{
  "name": "Thora",
  "level": 9,
  "equipment": {
    "armor": {
      "baseId": "ID_FMP_ARMOR_12",
      "enchantmentId": "ID_FMP_MAGIC_ITEM_32",
      "enhancement": 2
    },
    "shield": {
      "baseId": "ID_FMP_ARMOR_3",
      "enhancement": 0
    },
    "mainHand": {
      "baseId": "ID_FMP_WEAPON_23",
      "enchantmentId": "ID_FMP_MAGIC_ITEM_1847",
      "enhancement": 3
    },
    "offHand": {
      "baseId": "ID_FMP_WEAPON_8",
      "enhancement": 0
    },
    "implement": {
      "superiorImplementId": "ID_FMP_SUPERIOR_IMPLEMENT_1",
      "enchantmentId": "ID_FMP_MAGIC_ITEM_501",
      "enhancement": 2
    },
    "neck": {
      "enhancement": 0
    }
  }
}
```

`enhancement` may be omitted on weapon/armor/implement slots; treat as **0**. For **neck**, always persist an explicit object when the slot is initialized (see Neck slot below).

## Migration from current shape

### Current fields (to deprecate)

```typescript
armorId?: string;
shieldId?: string;
mainWeaponId?: string;
offHandWeaponId?: string;
implementId?: string;
magicItemIds?: {
  armor?: string;
  neck?: string;
  mainWeapon?: string;
  offHandWeapon?: string;
  implement?: string;
};
```

### Migration algorithm (`normalizeCharacterBuild`)

For each slot, if `equipment` is already present, normalize and return.

Otherwise build `equipment` from legacy fields:

| New path | Source |
|----------|--------|
| `equipment.armor.baseId` | `armorId` |
| `equipment.armor.enchantmentId` | `magicItemIds.armor` |
| `equipment.armor.enhancement` | `magicItems[armor].enhancementBonus` if enchantment set, else `0` |
| `equipment.shield.*` | `shieldId`, `magicItemIds` (if we ever stored shield magic separately; today shield magic may be missing — default enchantment none) |
| `equipment.mainHand.*` | `mainWeaponId`, `magicItemIds.mainWeapon` |
| `equipment.offHand.*` | `offHandWeaponId`, `magicItemIds.offHandWeapon` |
| `equipment.implement.superiorImplementId` | `implementId` |
| `equipment.implement.enchantmentId` | `magicItemIds.implement` |
| `equipment.implement.enhancement` | from magic item row or `0` |
| `equipment.neck.enchantmentId` | `magicItemIds.neck` |
| `equipment.neck.enhancement` | from magic item row or `0` |

After migration, **strip** legacy keys from persisted JSON (or leave them unused for one release with read-only fallback).

**Lossy cases**: Characters that had only legacy `magicItemBonuses` (already stripped) cannot be reconstructed. Characters with magic but no mundane base will get `baseId` undefined and should be flagged in UI.

## ETL / index

No new compendium types required. Optional ETL improvements (later):

- Tag magic items with **slot kind** and **enhancement-only** vs **property** for cleaner enchantment picker grouping.
- Index magic items without enhancement in name for “property-only” browse (nice-to-have).

## UI (builder)

Per slot section:

1. Base selector (searchable).
2. Enchantment selector — “None (mundane)”, then filtered magic items.
3. Plus — `AdjustableNumberInput` or stepped 0–6.

Show derived summary: active numeric bonuses, enchantment property/power/critical text (short); full AC/attack breakdown remains on the builder live sheet tab.

Remove duplicate magic-only dropdown block from Equipment tab.

## UI (character sheet)

- `sheetStateFromBuild` maps `equipment` → inventory rows + `toBuildLikeState` for derived stats.
- Equipment tab on sheet: full base / enchantment / plus editor (reuses builder `EquipmentTab`); inventory slot dropdowns remain for custom gear.

## Implementation phases

1. **Types + migration** — `CharacterEquipment`, `normalizeCharacterBuild`, tests for migration examples. ✅ Done (`src/rules/equipment.ts`, `tests/rules/equipment.test.ts`).
2. **Rules** — `computeEquipmentCombatBonuses` in `equipment.ts` (layer 2 plus + layer 3 enchantment `statAdds` with enhancement filtering); `magicItemEquipment` delegates; duplicate-hand warning in validator. ✅ Done.
3. **Builder UI** — `EquipmentTab` three-step sections per slot; removed dual mundane/magic lists; no level filter on enchantments. ✅ Done.
4. **Sheet + storage** — `characterEquipment` on sheet state, `sheetStateFromBuild` / `toBuildLikeState` sync, inventory labels. ✅ Done.
5. **Cleanup** — remove `armorId` / `magicItemIds` from public API; update tests. ✅ Done (`CharacterBuild` uses `equipment` only; `LegacyCharacterBuildInput` for import migration; sheet storage migrates old `magicItemIds`).

## Decisions log

| Topic | Decision |
|-------|----------|
| Enchantment | Specific compendium `Magic Item`; None = mundane default |
| Plus | User +0…+6 on base; authoritative over item’s baked-in + |
| Default plus on enchantment pick | Set to that row’s `enhancementBonus`, or lowest +N parsed from the row when bonus field is missing |
| Slots | armor, shield, mainHand, offHand, implement, neck |
| Shield | Same 3-step as armor; magic list = armor-type items matching **shield** mundane types |
| Implement | Superior implement + magic + plus |
| Level filter | **No** level cap on magic lists |
| Type matching | **Yes** for armor/weapon/shield magic vs base |
| Duplicate hand enchantment | **Warning** if same `enchantmentId` on main and off-hand; do not block |
| Empty neck | Always `{ enhancement: 0 }`; add `enchantmentId` when selected |
| CB fidelity | Match CB where compendium allows; document deviations |
| Migration | Yes to `equipment` shape; preview above |

## Related files

- `src/rules/equipment.ts` — slot model, migration, `computeEquipmentCombatBonuses`
- `src/rules/magicItemEquipment.ts` — enchantment lookup and slot aggregation
- `src/features/builder/CharacterBuilderApp.tsx` — equipment tab
- `src/rules/models.ts` — `CharacterBuild`, `CharacterEquipment`
- `tools/etl/build_rules_index.py` — `magicItems`, `armors`, `weapons`, `implements`
