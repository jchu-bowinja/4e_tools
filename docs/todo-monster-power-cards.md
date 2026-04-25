# TODO: Monster Power Cards

- [x] Handling monster nested attack
  - Monster power cards now render compact nested attack details from both:
    - `nestedAttackDescriptions` text on outcomes.
    - Additional attack entries (`attacks[1..n]`) with their own name/range/bonuses and hit/miss/effect blocks.
  - Rendering also deduplicates repeated outcome text between primary and secondary attack sections to reduce noise.

- [ ] Improve ETL normalization for monster data
  - Standardize how source monster text is transformed into canonical fields so downstream rendering is less brittle.
  - Focus on consistent normalization of attacks, nested outcomes, keywords, and repeated formatting variants before JSON generation.

- [ ] Check for unrendered monster data (for example, traits)
  - Audit generated monster JSON against card output to identify fields that exist in data but are not rendered yet.

- [ ] Move monster tooltip glossary matching away from hardcoded UI phrase lists
  - Build description/details term matching from glossary data (term + aliases/subterms) instead of maintaining static phrase arrays in UI code.
  - Keep a small UI fallback list for critical terms, but prefer glossary-driven coverage for speed of updates and consistency.
  - Precompute/cache matcher artifacts (for example, sorted phrase regex or trie) so hover highlighting stays fast across large descriptions.

- [ ] Refactor shared glossary tooltip trigger + overlay architecture
  - Extract a reusable glossary trigger wrapper/component to avoid repeating hover/focus wiring and ARIA linking in each screen.
  - Centralize tooltip overlay rendering/positioning behavior (including keyboard dismissal and reduced-motion behavior) so Builder, Character Sheet, and Monster Editor stay in sync.
