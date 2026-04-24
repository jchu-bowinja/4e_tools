# TODO: Monster Power Cards

- [ ] Handling monster nested attack
  - Current card rendering uses the primary attack (`attacks[0]`) for compact lines and nested outcome text, but we intentionally rolled back full rendering of additional attacks (`attacks[1..n]`) for now.
  - Investigation found nested attack details can appear in two forms:
    - `nestedAttackDescriptions` text on an outcome (for example, secondary-target notes).
    - Full additional attack entries with their own name/range/bonuses and hit/miss/effect blocks.
  - Follow-up should design a compact, non-duplicative way to show secondary/nested attacks without reintroducing noisy duplicate lines.

- [ ] Improve ETL normalization for monster data
  - Standardize how source monster text is transformed into canonical fields so downstream rendering is less brittle.
  - Focus on consistent normalization of attacks, nested outcomes, keywords, and repeated formatting variants before JSON generation.

- [ ] Check for unrendered monster data (for example, traits)
  - Audit generated monster JSON against card output to identify fields that exist in data but are not rendered yet.
