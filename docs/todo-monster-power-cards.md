# TODO: Monster Power Cards

- [ ] Handling monster nested attack
  - Current card rendering uses the primary attack (`attacks[0]`) for compact lines and nested outcome text, but we intentionally rolled back full rendering of additional attacks (`attacks[1..n]`) for now.
  - Investigation found nested attack details can appear in two forms:
    - `nestedAttackDescriptions` text on an outcome (for example, secondary-target notes).
    - Full additional attack entries with their own name/range/bonuses and hit/miss/effect blocks.
  - Follow-up should design a compact, non-duplicative way to show secondary/nested attacks without reintroducing noisy duplicate lines.
