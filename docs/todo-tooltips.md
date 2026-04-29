# TODO: Tooltips and special terms

- [ ] Generalize special-term handling (avoid UI-only term lookups)
  - Today, multiple surfaces resolve glossary or “special” phrases via ad hoc UI lookups (maps, cached boolean checks, screen-specific phrase lists). Prefer a single pipeline: authoritative term definitions and aliases live in data (generated glossary / rules index), and the UI consumes a small, stable API (for example, `resolveTooltipText`, prebuilt matcher artifacts) instead of duplicating phrase lists per feature.
  - Goals: one place to add or fix a term, consistent behavior across Character Sheet, Monster Editor, and future screens; optional precompute step so matching stays fast on long text.
  - Related: monster power card items in `docs/todo-monster-power-cards.md` (glossary-driven matching, shared tooltip component); `src/data/tooltipGlossary.ts` and ETL that produce glossary JSON.
