# UI Bible

This document is the UI source of truth for the 4e Builder project. Consult it whenever adding, changing, or revising UI elements, and during any style or look-and-feel pass.

## Purpose and Usage

- Keep a unified look and feel across the main app and each subapplication.
- Reduce one-off UI patterns by reusing shared elements whenever possible.
- Improve maintainability by making style decisions explicit and repeatable.

Use this document for:

- New screens or major layout additions.
- Component revisions (visual or behavioral).
- Visual polish passes.
- Refactors that touch spacing, typography, color, or interaction states.

Priority when there is a conflict:

1. Existing product behavior that users depend on.
2. This UI bible.
3. Local component preferences.

If a local exception is needed, document the reason in the feature area and keep it as narrow as possible.

## Core Design Principles

- Consistency first: similar UI problems should have similar visual and interaction solutions.
- Clarity over ornament: visual styling should make meaning clearer, not add noise.
- Accessibility by default: keyboard, focus visibility, and readable contrast are baseline requirements.
- Reuse before creating: if a pattern already exists, extend it instead of creating a new style family.
- Stable mental model: avoid changing terminology, icon intent, or control placement without clear user value.
- **Shallow structure:** prefer fewer layout containers unless a wrapper has a clear job (grid area, collapsible body, stripe row, scroll region). Extra nesting makes responsive layout and refactors harder without improving UX.

## Visual Language

### Typography

- Use a clear hierarchy: page title, section title, body, metadata.
- Keep font families and weights consistent across subapplications.
- Prefer stable type scale steps over arbitrary one-off font sizes.
- Ensure long-form rules text remains readable at standard zoom levels.

### Spacing and Rhythm

- Use a small set of spacing increments and apply them consistently.
- Maintain predictable vertical rhythm in forms, cards, and details panels.
- Prefer whitespace grouping over decorative separators.

### Surfaces, Borders, and Elevation

- Use consistent corner radius values for related component families.
- Use elevation/shadow only to communicate hierarchy (for example, overlay vs base content).
- Keep borders subtle and semantically meaningful (grouping, separation, selection states).

### Color and Tokens

- Use semantic color roles, not ad hoc hex choices, in component styles.
- Reserve attention-drawing colors for important states (error, warning, success, active).
- Ensure text/background combinations meet readable contrast expectations.

### Interactive States

Every interactive component should support and visually distinguish:

- Default
- Hover
- Focus-visible
- Active/pressed
- Disabled
- Error (where relevant)
- Success/confirmation (where relevant)

State visuals should be consistent across buttons, fields, toggles, and list rows.

## Component Standards

### Buttons and Action Controls

- Use consistent primary/secondary/tertiary intent mapping.
- Primary actions should be visually prominent but not oversized relative to context.
- Destructive actions must be explicit in both label and styling.

### Inputs and Form Controls

- Keep label placement and helper/error text behavior consistent.
- Required/optional semantics should be presented uniformly.
- Validation messaging should be specific and adjacent to the affected field.

### Cards, Panels, and Sections

- Use shared card/panel primitives for repeated content containers.
- Keep heading structure and internal spacing predictable.
- Avoid creating feature-specific panel variants unless the data shape truly demands it.

#### Layout containers and DOM depth

**Default:** one visual “panel” (border, radius, padding, surface) per logical section — not nested panels that repeat the same chrome.

**When a wrapper is justified**

| Purpose | OK to add a container |
| --- | --- |
| CSS grid / flex layout (columns, rows, `minmax(0, 1fr)`) | Yes — prefer the shallowest element that owns the grid |
| Collapsible body (`details` content, `CollapsibleDisclosure` body) | Yes — one body wrapper for padding/gap |
| Row stripe, drag handle, or card shell | Yes — on the row or card root |
| Scroll clipping (`overflow: auto/hidden`) | Yes — on the scrollport only |
| Glossary / focus target | Yes — on the label affordance, not around whole sections |

**Avoid**

- **Pass-through wrappers** — a `motion.div` with a single child and no layout styles (move `minWidth: 0`, `gap`, etc. to the child or parent grid).
- **Duplicate panel tokens** — stacking `panelStyle`, `overviewCollapsiblePanelStyle`, nested bordered shells on the same section, or sidebar panel + collapsible body border for the same visual box.
- **Grid as vertical gap** — `display: grid` with a single column (`minmax(0, 1fr)`) only to space children; use `display: flex; flex-direction: column; gap` on the parent, or `gap` on an existing grid.
- **Fake inputs** — bordered inner `motion.div` around static readonly text; use one field surface (label + value in one cell or a shared readonly field component).
- **Redundant section titles** — a wrapper `motion.div` whose only job is to hold a heading; use `h2`/`h3` with margin on the section root.

**Prefer**

- **Semantic elements** where they match structure: `section`, `article` (power cards), `ul`/`li` (inventory), `dl`/`dt`/`dd` (definition lists) instead of anonymous `div` chains.
- **Shared layout primitives** when the same nesting appears twice (e.g. one `PowerCard`, one overview field grid) rather than copying deep trees in sheet, builder, and monster editor.
- **CSS on the existing surface** — padding and gap via class or token on the panel you already have, not an extra inner `div`.

**Practical depth guideline**

- Aim for **≤ 4 layout wrappers** from a page section root to a leaf control (label + input, table row, or button). Deeper trees are a smell unless required by tables, collapsibles, or drag-and-drop.
- Before adding a `motion.div`, ask: can this style live on the parent grid, a shared component, or a class?

**Cross-feature patterns to consolidate (when touching those areas)**

- Builder: `ui.mainColumn` is the sole main-tab panel shell; use `blockInset` for subsections inside a tab (do not nest a second bordered `blockContent` wrapper).
- Builder sidebar: `sidebarPanel` + `LiveSheetCollapsibleSection` body border — one border per section.
- Character sheet overview: tab `panelStyle` + per-block bordered boxes + `OverviewCollapsibleSection` panel — flatten where possible.
- Power display: sheet, builder, and monster editor share similar deep card trees — extract shared card markup when changing any of them.

#### Collapsible disclosure (expand / collapse)

Use the shared **`CollapsibleDisclosure`** and **`CollapsibleDisclosureArrow`** components from `src/ui/CollapsibleDisclosure.tsx` whenever a section expands or collapses with a leading indicator (JSON snippets, character-sheet overview blocks such as ability scores and skills, template preview panels, roster expand-all controls).

- **Do not** hand-roll `<details>` / `<summary>` markup with a one-off arrow character or placeholder (`?`, `+`, native markers). Reuse the component so the indicator and rotation stay consistent.
- Styling lives in `src/styles.css` under `.template-json-collapsible` and `.template-json-collapsible-arrow`: collapsed shows **▶**; open rotates the arrow 90° (points down). Summary rows hide the browser default disclosure marker.
- Pass section-specific layout via `style`, `summaryStyle`, and optional `bodyStyle` props; add a feature class on `className` only when local overrides are required (for example `character-sheet-overview-collapsible`).
- For toggle buttons that are not `<details>` (for example expand-all on an encounter roster), render **`CollapsibleDisclosureArrow`** inside the button and reuse the same CSS hooks documented in `styles.css`.

### Lists, Tables, and Data Rows

- Use consistent row density and alignment rules.
- Keep sorting/filtering interaction patterns uniform when used.
- Empty, loading, and error states should use shared phrasing and layout conventions.

#### Character sheet score breakdown tables

The character sheet uses shared breakdown tables for **skills**, **defenses**, **speed / initiative**, and **ability scores**. Each row answers: “What is the total?” and “What is it called?” before showing how the total is built.

**Canonical layout (left → right)**

| Column | Role | User priority |
| --- | --- | --- |
| 1 — Bonus / total | Final modifier or defense value | **Primary** — always visible |
| 2 — Name / label | Skill name, defense name, ability code, etc. | **Primary** — always visible |
| 3+ — Components | Ability mod, ½ level, armor, trained bonus, etc. | **Secondary** — may clip when space is tight |

**Resize contract (non-negotiable)**

The **bonus value** and **row name** are the two anchors users scan first. They must remain legible at any viewport width or panel squeeze. When horizontal space runs out:

1. **Keep** the bonus column and name column at usable widths.
2. **Clip** component columns on the **right** (`overflow: hidden` on the table; no whole-table horizontal scrollbar).
3. **Do not** overlap names onto component values, shrink the bonus column below its content, or ellipsis-truncate primary columns to “make room” for math columns.
4. **Do not** give each row its own label width — one shared label track per table, sized to the **longest** label in that table (and the stat-column header when shown, e.g. `DEFENSE`).

**Shared visual language**

- **Totals** use emphasized score cells (`ScoreModCell` with `emphasize`) — bold, tabular figures, `var(--status-success)` for modifiers and defenses.
- **Component values** use the standard score cell style; em dash (`—`) for empty optional slots.
- **Row striping** alternates `var(--table-stripe-even)` / `var(--table-stripe-odd)` on bonus, label, and component cells.
- **Headers** are small caps, muted (`var(--text-muted)`), often stacked on two lines (e.g. `Base +` / `½ Lvl`, `Trnd` / `(+5)`).
- **Spacing tokens** (shared with skills): `--skill-bonus-name-gap` (gap between bonus and name), `--skill-col-gap` (column gap), `font-variant-numeric: tabular-nums` on the table.
- **Label backgrounds** on prioritized stat tables use an opaque stripe (`--stat-row-bg`) so clipped component columns do not show through under the name when rows overlap in z-order.

**Implementation map**

| Character sheet section | Component | Required props / classes |
| --- | --- | --- |
| Skills | `SkillModifierTable` | Measures `--skill-name-block-width`; bonus + name columns fixed priority; five component columns with fixed track widths |
| Defenses | `StatScoreTable` | `prioritizeStatLabel`, `className="stat-score-table--compact"`, `statHeader="DEFENSE"` |
| Speed + initiative | `StatScoreTable` | `prioritizeStatLabel`, `stat-score-table--compact`, `statHeader={null}` |
| Ability scores | `StatScoreTable` | Single component column (`Score`); short fixed labels — compact prioritize mode optional |

Styles live in `src/styles.css` (`.skill-modifier-table`, `.stat-score-table`). Cell primitives live in `src/ui/scoreTableCells.tsx`.

**Skills (`SkillModifierTable`)**

- Grid: bonus column (`minmax(2.35rem, max-content)`), name column (`minmax(var(--skill-name-block-width), 1fr)`), then five fixed-width component columns.
- On mount and resize, measure every `.skill-modifier-table__name-text` (and header) and set `--skill-name-block-width` to the widest natural width so `Acrobatics` and `Diplomacy` share one name track.
- Name cell may include trailing metadata (trained `(T)`, ability code right-aligned) inside the measured block; glossary hover attaches to the name affordance, not the bonus cell.
- Table `overflow: hidden` — modifier columns fall off the right edge when narrow.

**Defenses, speed, initiative (`StatScoreTable` + `prioritizeStatLabel` + `stat-score-table--compact`)**

- Pass `prioritizeStatLabel` on any character-sheet breakdown where component columns can crowd the label.
- Use `stat-score-table--compact` so all component tracks sit in one grid row (not a nested breakdown subgrid) and the label column is `minmax(var(--stat-label-min-width), 1fr)`.
- `StatScoreTable` measures `.stat-score-table__stat-label-text` and `.stat-score-table__stat-hdr`, then sets `--stat-label-min-width` to the longest label (including `DEFENSE` when `statHeader` is set). Short labels (`AC`, `Will`, `Speed`) use the same column width as `Fortitude` / `Initiative`.
- Bonus column `z-index: 3`, label `z-index: 2`, components `z-index: 0` — totals and names paint above clipped math.
- Signed totals (initiative) use `signedTotal` / `formatScoreTotalDisplay` (`+N` / `N`).

**Ability scores**

- Same `StatScoreTable` / `ScoreModCell` family for consistency; only one breakdown column and three-letter labels, so full prioritize/compact stack is usually unnecessary.
- Glossary tooltips on ability codes follow the label-only tooltip rule (not on the numeric score cell).

**Adding a new breakdown table**

- Extend `StatScoreTable` or `SkillModifierTable` — do not hand-roll grids on the character sheet.
- If the table has multiple component columns and a variable-width name, enable `prioritizeStatLabel` (and `stat-score-table--compact` for stat-style tables).
- Measure the longest label in that table instance; never hard-code per-row label widths.
- Verify by narrowing the overview column: bonus and name stay readable; right-side columns clip cleanly with no text collision.

See also **Layout and Responsiveness** (content priority when stacking) and the UI review checklist items for score tables.

### Overlays (Tooltips, Popovers, Modals)

- Use the lightest overlay that solves the job (tooltip before popover, popover before modal).
- Keep overlay spacing and close behavior consistent.
- Ensure keyboard focus moves into and out of overlays predictably.

#### Glossary and rules tooltips (hover panels)

- Attach glossary or rules-rich **hover tooltips to label copy or other explicit help affordances** (for example field titles, dotted “glossary” tokens, or a dedicated help control).
- **Do not** wire the same hover glossary behavior to **value `<input>` controls** (number fields, text fields, selects): interacting with or mousing across the field to edit a value should not open glossary panels.
- When a field needs both glossary context and a compact layout, use a real **`<label htmlFor="…">`** (or adjacent caption text) for the tooltip target and associate the input via `id` / `aria-labelledby` so the glossary remains discoverable without covering the value control.
- **Do not** put a native HTML **`title`** tooltip on the same element that already opens a **glossary or custom hover panel** for the same content: the browser will show both, which reads as duplicate or conflicting help.

### Badges, Tags, and Status Indicators

- Use these elements to communicate state, category, or importance, not decoration.
- Keep color and shape semantics consistent across subapplications.

## Layout and Responsiveness

- Use a shared page scaffold pattern for title, controls, content, and secondary detail regions.
- Align on common breakpoints and avoid feature-specific breakpoint values unless required.
- Keep responsive behavior predictable: stack, collapse, or scroll based on content priority.
- Preserve critical actions and key metadata visibility across viewport sizes.
- **Character sheet overview columns** use `minWidth: 0` and `overflow: hidden` on side columns so grids can shrink; score breakdown tables inside those columns must still honor the [score table resize contract](#character-sheet-score-breakdown-tables) (bonus + name stay visible; math columns clip on the right).

For all major screens, define behavior for:

- Loading state
- Empty state
- Error state
- Data-dense state

## Subapplication Alignment

Subapplications can have local personality, but must share the same baseline interaction language.

Required shared baseline:

- Typography scale and spacing system
- Core component behaviors and state treatments
- Standard action hierarchy and terminology
- Accessibility expectations

Allowed local variation:

- Context-specific layout composition
- Domain-specific iconography or content emphasis
- Minor visual accents that do not conflict with baseline semantics

When introducing variation, include a short note in feature documentation describing:

- Why the variation is needed
- Which baseline rule remains unchanged
- How the variation can be reused elsewhere, if applicable

## Reusability and Drift Prevention

- Build or extend shared components before creating local one-off implementations.
- Prefer composition and configurable variants over duplicated near-identical components.
- Centralize style tokens and shared primitives to minimize drift over time.
- During refactors, migrate repeated local patterns to shared components incrementally.
- Remove or deprecate obsolete style variants once replacements are adopted.

Naming guidance:

- Use names that describe component role/intent, not a specific page.
- Keep variant names semantic (`primary`, `danger`, `compact`) and consistent.

## UI Review Checklist

Use this checklist before merging UI/style/look-and-feel work:

- [ ] Existing shared components were reused before creating new ones.
- [ ] New or updated components match established typography, spacing, and state behavior.
- [ ] Interactive elements have clear hover/focus/active/disabled states.
- [ ] Labels, helper text, and validation/error copy are clear and consistent.
- [ ] Layout works across intended viewport sizes without hiding critical actions.
- [ ] Loading, empty, and error states are handled and visually consistent.
- [ ] Accessibility basics are met (keyboard navigation, focus visibility, readable contrast).
- [ ] Any local subapplication variation is documented and intentionally scoped.
- [ ] Obvious one-off styles were avoided or justified with a clear reason.
- [ ] Glossary or rules hover tooltips are not attached to raw value inputs; they use labels or explicit help text instead.
- [ ] Expand/collapse sections use `CollapsibleDisclosure` (or `CollapsibleDisclosureArrow` for non-details toggles), not ad-hoc arrows or placeholders.
- [ ] Character sheet score tables use `SkillModifierTable` / `StatScoreTable` with shared `scoreTableCells` styling — not one-off layouts.
- [ ] Breakdown tables with variable-width names use measured label width (`--skill-name-block-width` or `--stat-label-min-width`) and a single shared name column per table.
- [ ] Resizing or narrowing the panel keeps the **bonus/total** and **row name** readable; only right-hand component columns clip (no table-level horizontal scroll, no label-on-math overlap).
- [ ] New UI does not stack duplicate panel borders or pass-through wrappers; layout depth stays shallow unless collapsible, grid, or scroll requires otherwise.

## Update Process

When UI decisions repeat across features, update this document so the guideline becomes explicit.

Recommended cadence:

- Review during major UI passes.
- Add rules when recurring design questions appear in code review.
- Remove or revise guidance that no longer reflects shared practice.
