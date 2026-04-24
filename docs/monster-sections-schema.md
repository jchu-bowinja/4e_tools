# Monster Sections Schema

This document describes normalized fields currently emitted under `sections` by the monster ETL (`tools/etl/build_monster_index.py`).

## Shape

`sections` is an object with optional keys. A key is omitted when no meaningful value is found.

## Normalized Fields

- `groupRole: string`
  - Example values: `"Standard"`, `"Elite"`, `"Solo"`

- `alignment: { id?: string | number; name?: string; description?: string }`
  - Example:
    - `{ "id": 4, "name": "Evil", "description": "Evil creatures ..." }`
    - `{ "id": 1, "name": "Unaligned", "description": "Unaligned creatures ..." }`

- `languages: string[]`
  - Example values:
    - `["Draconic", "Elven"]`
    - `["Argon", "Common", "Draconic", "Giant"]`
    - `["Supernal"]`

- `keywords: string[]`
  - Example values:
    - `["Dragon"]`
    - `["Construct"]`
    - `["Aquatic", "Dragon", "Undead"]`

- `immunities: string[]`
  - Example values:
    - `["Disease", "Poison", "Sleep"]`
    - `["attacks by creatures of lower than 20th level"]`

- `senses: Array<{ name: string; range?: string | number }>`
  - Example values:
    - `[{"name":"Darkvision","range":0}]`

- `resistances: Array<{ name?: string; amount?: string | number; details?: string }>`
  - Example values:
    - `[{"name":"Necrotic","amount":10},{"name":"Psychic","amount":10}]`
    - `[{"name":"Cold","amount":20},{"name":"Fire","amount":20}]`

- `weaknesses: Array<{ name?: string; amount?: string | number; details?: string }>`
  - Example values:
    - `[{"name":"Radiant","amount":5}]`
    - `[{"name":"against","amount":10,"details":"close and area attacks"}]`

- `sourceBook: { id?: string | number; name?: string; description?: string; url?: string }`
  - Example:
    - `{ "id": 11, "name": "Draconomicon 1", "url": "http://www.wizards.com/default.asp?x=products/dndacc/217887200" }`

- `sourceBooks: string[]`
  - Example values:
    - `["Draconomicon 1", "Underdark"]`
    - `["Dungeon Magazine 211"]`
    - `["Dragons of Eberron"]`

- `regeneration: number`
  - Example values: `0`, `10`

- `items: Array<{ quantity?: string | number; name?: string }>`
  - Example values:
    - `[{"quantity":1,"name":"bone dagger"}]`
    - `[{"quantity":1,"name":"Hide Armor"},{"quantity":1,"name":"Greataxe"}]`

## Related Normalized Stat Fields

These are normalized under `stats.otherNumbers` (not under `sections`):

- `initiative: number`
- `hitPoints: number`
- `actionPoints: number`
- `savingThrows: number`
- `movement: Array<{ type: string; value: string | number }>`
  - Example:
    - `[{"type":"Land","value":9},{"type":"Fly","value":9},{"type":"Overland Flight","value":12},{"type":"Swim","value":9}]`

## Notes

- Unknown or unmapped XML sections still appear under `sections` in a raw structured fallback shape (`attrs` / `text` / `children`), so data is not lost.
- Some entries still reflect source XML quality issues (for example, split weakness clauses such as `"his"` or `"against"` as a name). These are candidates for a later cleanup pass.
- Raw `Initiative`, `SavingThrows`, `HitPoints`, `ActionPoints`, `LandSpeed`, `Speeds`, `Regeneration`, and `Items` are intentionally excluded from `sections` once normalized.
