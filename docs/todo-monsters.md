# TODO: Monsters

Backlog for monster data, power cards, templates, and monster-facing UI (including editor tooltips).

## Power cards and rendering

- [x] Handling monster nested attack
  - Monster power cards now render compact nested attack details from both:
    - `nestedAttackDescriptions` text on outcomes.
    - Additional attack entries (`attacks[1..n]`) with their own name/range/bonuses and hit/miss/effect blocks.
  - Rendering also deduplicates repeated outcome text between primary and secondary attack sections to reduce noise.

- [ ] Check for unrendered monster data (for example, traits)
  - Audit generated monster JSON against card output to identify fields that exist in data but are not rendered yet.

## Data, ETL, and level or tier

- [ ] Improve ETL normalization for monster data
  - Standardize how source monster text is transformed into canonical fields so downstream rendering is less brittle.
  - Focus on consistent normalization of attacks, nested outcomes, keywords, and repeated formatting variants before JSON generation.

- [ ] Per-level and per-tier handling for monsters and templates
  - Model or surface how stats, powers, and traits differ across monster level (and template tier where applicable) instead of assuming a single flat snapshot.
  - Align ETL, editor, and card rendering so scaled values, level ranges, and tier-specific variants stay consistent end to end.

- [ ] Parse level-based damage expressions in damage templates and apply them to monsters
  - Add parsing support for template damage expressions that scale by level (for example formula-driven or tier-bracket expressions) and persist the parsed representation.
  - Apply resolved values when templates are attached to monsters so resulting attacks/powers reflect the monster's target level consistently across ETL and editor flows.

- [ ] Adjust monster XP when applying a template
  - Update template-application flow to recalculate or remap monster XP when a template changes effective level, role, or tier assumptions.
  - Ensure persisted monster/template output keeps XP in sync with derived post-template stats so encounter budgeting remains accurate.

## Tooltips (monster editor / power cards)

- [ ] Move monster tooltip glossary matching away from hardcoded UI phrase lists
  - Build description/details term matching from glossary data (term + aliases/subterms) instead of maintaining static phrase arrays in UI code.
  - Keep a small UI fallback list for critical terms, but prefer glossary-driven coverage for speed of updates and consistency.
  - Precompute/cache matcher artifacts (for example, sorted phrase regex or trie) so hover highlighting stays fast across large descriptions.

- [ ] Refactor shared glossary tooltip trigger + overlay architecture
  - Extract a reusable glossary trigger wrapper/component to avoid repeating hover/focus wiring and ARIA linking in each screen.
  - Centralize tooltip overlay rendering/positioning behavior (including keyboard dismissal and reduced-motion behavior) so Builder, Character Sheet, and Monster Editor stay in sync.
