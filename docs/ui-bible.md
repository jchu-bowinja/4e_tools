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

#### Score breakdown tables (skills, defenses, speed, initiative)

Character-sheet style breakdown tables show a **total** in the leading column, a **row label** (skill name, defense name, etc.), then **component columns** for the math.

- **Prioritize the total and the row label.** Those two columns are the anchors users scan first. They must stay readable when the panel is narrow or when many component columns are present.
- **Align breakdown columns on the longest label.** Every row in a table must share the **same** label-column track, with a **minimum** width equal to the longest row label (and the stat-column header when shown, e.g. `DEFENSE`). Short labels such as `AC` or `Speed` must not use a narrower track than `Fortitude` or `Initiative`; otherwise component values appear jagged row to row when the panel is narrow or resized. Do not give each row its own `max-content` or `1fr` label track.
- **Narrow panels:** clip or hide content on the **right** (component columns), not by overlapping labels onto the math. Do not add a horizontal scrollbar on the whole table.
- **Skills** (`SkillModifierTable`): bonus and skill name stay in the left columns; `--skill-name-block-width` is the max measured name width; modifier columns share one grid and fall off the right edge when space is tight.
- **Defenses** (`StatScoreTable` with `prioritizeStatLabel`): green total and row label stay visible; `--stat-label-min-width` is the measured longest label in that table; the label track is `minmax(that minimum, max-content)`; component columns live in a flexible third track and **right-align** as a group when the panel is wide; component columns clip on the right when narrow.
- **Speed + initiative** (`stat-score-table--compact` + `prioritizeStatLabel`): same label minimum and shared `subgrid` alignment; the label track is `minmax(that minimum, 1fr)` so the Speed/Initiative column **fills** the space up to the Race column (no empty gap); component columns clip on the right when narrow.
- **Component columns** are secondary; do not sacrifice total or label legibility to keep every header on one line.
- Reuse `StatScoreTable` / `SkillModifierTable` and shared score cell styling (`scoreTableCells`) rather than one-off breakdown layouts.

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

## Update Process

When UI decisions repeat across features, update this document so the guideline becomes explicit.

Recommended cadence:

- Review during major UI passes.
- Add rules when recurring design questions appear in code review.
- Remove or revise guidance that no longer reflects shared practice.
