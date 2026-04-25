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

### Lists, Tables, and Data Rows

- Use consistent row density and alignment rules.
- Keep sorting/filtering interaction patterns uniform when used.
- Empty, loading, and error states should use shared phrasing and layout conventions.

### Overlays (Tooltips, Popovers, Modals)

- Use the lightest overlay that solves the job (tooltip before popover, popover before modal).
- Keep overlay spacing and close behavior consistent.
- Ensure keyboard focus moves into and out of overlays predictably.

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

## Update Process

When UI decisions repeat across features, update this document so the guideline becomes explicit.

Recommended cadence:

- Review during major UI passes.
- Add rules when recurring design questions appear in code review.
- Remove or revise guidance that no longer reflects shared practice.
