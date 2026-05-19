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
- **Bounded numeric fields** (`AdjustableNumberInput`): allow free typing while focused; validate on blur (or Enter). If the value is out of range or not a number, revert to the last committed value instead of clamping on every keystroke.

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
- Builder page header: the `h1` title and persistence actions (export, save/load, reset, import JSON) share one flex row (`pageHeaderRowStyle`); actions wrap and align to the end on wide viewports. Character name and level stay on the row below (`ui.chromeFields`).
- Builder sidebar: `ui.sidebarPanel` supplies the section border; `LiveSheetCollapsibleSection` body is layout-only (no second border). Stack sections with flex `gap` on the panel, not an extra inner grid wrapper.
- Character sheet overview: one `panelStyle` tab shell; character identity uses `CharacterIdentityField` / `CharacterIdentitySection` (`dl`/`dt`/`dd`, class `.character-sheet-identity` in CSS)—no nested bordered boxes per field; glossary and race/class hover on **labels** only; overview rows are direct grid children (no `character-sheet-overview-rows` wrapper); collapsible body spacing via `.character-sheet-overview-collapsible > :not(summary)` in CSS.
- Power display: character builder and character sheet use **`CharacterPowerCard`** (`src/ui/powerCard/`) with `buildCharacterPowerCardViewModel`; pass `renderLineText`, `renderKeyword`, and `renderBody` for glossary/rich text. Monster editor keeps its own card body but shares shell/accent helpers (`monsterPowerCardShellStyle`, action bucket accents) from the same module.
- Character sheet HP / conditions: overview center column uses one grid per row (vitals row 1: four columns; row 2: death saves + healing surges). Healing surges cell is a single bordered grid (label + flex row for input, button column, hint); do not nest a second grid around the label. Spend Surge / Second Wind stack in a flex column on that row. Conditions panel applies `gap` on the outer bordered grid only—toolbar rows are direct children, not wrapped in an extra pass-through grid.

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

#### Table sizing and horizontal scroll (all tables)

Every data table — native `<table>`, `ScoreBreakdownTable`, or future grid-based tables — must follow the same **fill + scroll** contract:

| Axis | Rule |
| --- | --- |
| **Width** | Table scrollport uses `width: 100%` and `max-width: 100%` of its panel. Flexible name/label tracks use `minmax(measured-min, 1fr)` so extra horizontal space goes into the label column, not empty margin. |
| **Height** | Table scrollport uses **natural row height** from shared padding tokens (do not squash rows). The scrollport spans the **full width** of its slot; vertically it grows with row count. When a parent layout assigns a fixed-height region (e.g. a tall sidebar list), the scrollport may use `height: 100%` and `overflow-y: auto` — pair vertical scroll with horizontal scroll only when both axes can overflow. |
| **Horizontal overflow** | When content is wider than the panel, show a **horizontal scrollbar** on the table scrollport (`overflow-x: auto`). Never clip or crush component/value columns to fit. |
| **Minimum content width** | Inner grid (`score-breakdown-table__sync-grid` or per-row grids) uses `min-width: max-content` so the scrollport can scroll. Component tracks use `minmax(W, W)` so fixed columns do not collapse. |
| **Shared name/label column** | One label track per table, never per-row widths — see [shared label column](#shared-label-column-all-breakdown-tables). |

**Implementation**

| Table kind | Scrollport | Notes |
| --- | --- | --- |
| Native `<table>` | `TableScrollport` (or `.table-h-scroll`) | Inner table: `width: 100%`, `min-width: max-content` |
| Skills | `ScoreBreakdownTable` (`variant="skill"`) | `useMeasuredLabelWidth` → `--score-breakdown-label-width` |
| Stat breakdowns | `ScoreBreakdownTable` (`variant="stat"`, `compact` when needed) | `useMeasuredLabelWidth` → `--score-breakdown-label-width`; inner `__sync-grid` when `compact` + `prioritizeLabel`; see [score breakdown tables](#character-sheet-score-breakdown-tables) |

Shared primitives: `TableScrollport`, `useMeasuredLabelWidth`, `tableLayout.ts`, **`ScoreBreakdownTable`** (skills + stat breakdowns). Skill row helpers: `scoreBreakdownSkill.ts`, `scoreBreakdownSkillName.tsx`.

**Parent layout:** Panels that host tables must pass width constraints down (`min-width: 0` on grid/flex children). Side columns may use `overflow: hidden` on the column shell; the **table** inside still owns `overflow-x: auto` on its scrollport.

**Do not**

- Set `min-width: max-content` on the **scrollport** root (parent clips instead of scrolling) — only the inner sync grid or rows use `min-width: max-content`.
- Size label/name columns per row independently (breaks alignment for short values like `AC` vs `Fortitude`).
- Use `overflow: hidden` on the table scrollport to hide overflowing columns.
- Hand-roll per-page table layout when `ScoreBreakdownTable` or `.table-h-scroll` applies.

#### Shared label column (all breakdown tables)

Every breakdown table with variable-width row names (skills, defenses, speed, initiative) must use **one shared label track per table instance**, sized to the **longest** label text (and column header when shown, e.g. `DEFENSE` or `Acrobatics`).

| Table | Mechanism |
| --- | --- |
| Skills | `useMeasuredLabelWidth` on `ScoreBreakdownTable` (`variant="skill"`); sets `--score-breakdown-label-width`; every row uses `minmax(var(--score-breakdown-label-width), 1fr)` for the label column. |
| Defenses, speed, initiative | `useMeasuredLabelWidth` when `prioritizeLabel`; sets `--score-breakdown-label-width`; `compact` tables use an inner `.score-breakdown-table__sync-grid` with **subgrid** so all rows share one label column track. |

**Rules**

1. Measure on mount and on resize; seed with a synchronous estimate so the first paint is close (no flash of narrow `AC` beside wide `Fortitude`).
2. Short labels must not define a narrower column — the track minimum is always the longest measured label in **that table**.
3. Extra horizontal space may grow the label column (`1fr` max on `minmax(--*-min-width, 1fr)`); it must not shrink below the measured minimum.
4. Do not remove `--score-breakdown-label-width` during measurement passes (distorts the measure).

#### Character sheet score breakdown tables

The character sheet uses shared breakdown tables for **skills**, **defenses**, **speed / initiative**, and **ability scores**. Each row answers: “What is the total?” and “What is it called?” before showing how the total is built.

**Canonical layout (left → right)**

| Column | Role | User priority |
| --- | --- | --- |
| 1 — Bonus / total | Final modifier or defense value | **Primary** — always visible |
| 2 — Name / label | Skill name, defense name, ability code, etc. | **Primary** — always visible |
| 3+ — Components | Ability mod, ½ level, armor, trained bonus, etc. | **Secondary** — reachable via horizontal scroll when space is tight |

**Resize contract (non-negotiable)**

Follows the global [table sizing and horizontal scroll](#table-sizing-and-horizontal-scroll-all-tables) rules. Additionally, the **bonus value** and **row name** are the two anchors users scan first:

1. **Keep** the bonus column and name column at usable widths (measured label track; no per-row label widths). The name/label column grows with `1fr` when extra horizontal space is available.
2. **Fill** the panel width when content is narrower than the container; **scroll** horizontally when content is wider, so component columns stay readable instead of clipping.
3. **Do not** overlap names onto component values, shrink the bonus column below its content, or ellipsis-truncate primary columns to “make room” for math columns.
4. **Do not** give each row its own label width — one shared label track per table, sized to the **longest** label in that table (and the stat-column header when shown, e.g. `DEFENSE`).

**Shared visual language**

- **Totals** use emphasized score cells (`ScoreModCell` with `emphasize`) — bold, tabular figures, `var(--status-success)` for modifiers and defenses.
- **Component values** use the standard score cell style; em dash (`—`) for empty optional slots.
- **Row striping** alternates `var(--table-stripe-even)` / `var(--table-stripe-odd)` on bonus, label, and component cells.
- **Headers** are small caps, muted (`var(--text-muted)`), often stacked on two lines (e.g. `Base +` / `½ Lvl`, `Trnd` / `(+5)`).
- **Spacing tokens**: `--score-breakdown-bonus-label-gap`, `--score-breakdown-col-gap`, `font-variant-numeric: tabular-nums` on the table.
- **Label backgrounds** on prioritized stat tables use an opaque stripe (`--score-breakdown-row-bg`) so component columns do not show through under the name during horizontal scroll.

**Implementation map**

| Character sheet section | Component | Required props / classes |
| --- | --- | --- |
| Skills | `ScoreBreakdownTable` (`variant="skill"`) | Measures `--score-breakdown-label-width`; bonus + label columns fixed priority; five component columns with fixed track widths |
| Defenses | `ScoreBreakdownTable` (`variant="stat"`) | `prioritizeLabel`, `compact`, `labelHeader="DEFENSE"` |
| Speed + initiative | `ScoreBreakdownTable` (`variant="stat"`) | `prioritizeLabel`, `compact`, `labelHeader={null}` |
| Ability scores | `ScoreBreakdownTable` (`variant="stat"`) | Single component column (`Score`); short fixed labels — compact prioritize mode optional |

Styles live in `src/styles.css` (`.table-scrollport`, `.score-breakdown-table`, modifiers `--stat` / `--skill`). Cell primitives: `src/ui/scoreTableCells.tsx`. Table stack: `ScoreBreakdownTable` → `TableScrollport` + `useMeasuredLabelWidth`.

**Skills (`variant="skill"`)**

- Grid: bonus column (`minmax(2.35rem, max-content)`), label column (`minmax(var(--score-breakdown-label-width), 1fr)`), then five fixed-width component columns (`minmax(W, W)` per track).
- On mount and resize, measure every `.score-breakdown-table__label-text` (and header) and set `--score-breakdown-label-width` to the widest natural width so `Acrobatics` and `Diplomacy` share one label track.
- Name cell may include trailing metadata (trained `(T)`, ability code right-aligned) inside the measured block; glossary hover attaches to the name affordance, not the bonus cell.
- Root: `width: 100%`, `max-width: 100%`, `overflow-x: auto`. Rows: `width: 100%`, `min-width: max-content`.

**Defenses, speed, initiative (`variant="stat"` + `prioritizeLabel` + `compact`)**

- Pass `prioritizeLabel` on any character-sheet breakdown where component columns can crowd the label.
- Pass `compact` so all component tracks sit in one grid row; `ScoreBreakdownTable` wraps header + rows in `.score-breakdown-table__sync-grid` (subgrid) so label and component columns stay aligned across rows.
- Label column track: `minmax(var(--score-breakdown-label-width), 1fr)` on the sync grid. `--score-breakdown-label-width` comes from DOM measure + estimate (includes `DEFENSE` header when `labelHeader` is set). Short labels (`AC`, `Will`, `Speed`) share the same column width as `Fortitude` / `Initiative`.
- **Scrollport** (outer `.score-breakdown-table--prioritize-label`): `min-width: 0`, `width: 100%`, `overflow-x: auto`. **Inner grid** (`.score-breakdown-table__sync-grid`): `min-width: max-content`, `width: 100%`. Component columns emitted as `minmax(W, W)`.
- Bonus column `z-index: 3`, label `z-index: 2`, components `z-index: 0` — totals and names stay visually anchored during horizontal scroll.
- Signed totals (initiative) use `signedTotal` / `formatScoreTotalDisplay` (`+N` / `N`).

**Ability scores**

- Same `ScoreBreakdownTable` / `ScoreModCell` family for consistency; only one breakdown column and three-letter labels, so full prioritize/compact stack is usually unnecessary.
- Uses the same `width: 100%` / `overflow-x: auto` scrollport as other stat tables; label column `minmax(0, 1fr)` absorbs extra width.
- Glossary tooltips on ability codes follow the label-only tooltip rule (not on the numeric score cell).

**Builder ability table**

- Physical / mental ability `<table>` elements in `CharacterBuilderApp` are wrapped in `.table-h-scroll` (same native-table contract as above).

**Adding a new breakdown table**

- Use `ScoreBreakdownTable` with `variant="skill"` or `variant="stat"` — do not hand-roll grids on the character sheet.
- If the table has multiple component columns and a variable-width name, enable `prioritizeLabel` (and `compact` for stat-style tables).
- Measure the longest label in that table instance; never hard-code per-row label widths.
- Verify: (1) wide panel — table spans full panel width, label column grows; (2) narrow panel — horizontal scrollbar appears before columns overlap or truncate; (3) row height stays readable (no vertical crush).

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
- **Character sheet overview columns** use `minWidth: 0` and `overflow: hidden` on side columns so grids can shrink; tables inside those columns must still honor [table sizing and horizontal scroll](#table-sizing-and-horizontal-scroll-all-tables) (full width of slot, horizontal scroll when squeezed).

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
- [ ] Data tables use the shared fill + scroll contract (`TableScrollport` / `ScoreBreakdownTable`, or thin wrappers) — not one-off layouts without horizontal scroll.
- [ ] Table scrollports use `width: 100%` of their panel; flexible label/name columns grow with `1fr` when space allows.
- [ ] Narrow panels show horizontal scroll on the table scrollport before columns crush or overlap (no `overflow: hidden` on table roots).
- [ ] Character sheet score tables use shared `scoreTableCells` styling; variable-width names use measured label width (`--skill-name-block-width` or `--stat-label-min-width`).
- [ ] Score breakdown tables keep **bonus/total** and **row name** readable; short labels use the same name column width as the longest label in that table.
- [ ] Prioritize/compact stat tables use `.score-breakdown-table__sync-grid` (subgrid), not independent per-row column sizing.
- [ ] Table scrollport uses `min-width: 0`; inner grid/rows use `min-width: max-content`.
- [ ] Row height uses shared padding tokens — rows are not vertically crushed to fake fit.
- [ ] New UI does not stack duplicate panel borders or pass-through wrappers; layout depth stays shallow unless collapsible, grid, or scroll requires otherwise.

## Update Process

When UI decisions repeat across features, update this document so the guideline becomes explicit.

Recommended cadence:

- Review during major UI passes.
- Add rules when recurring design questions appear in code review.
- Remove or revise guidance that no longer reflects shared practice.
