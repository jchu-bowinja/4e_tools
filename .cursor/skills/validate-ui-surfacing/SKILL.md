---
name: validate-ui-surfacing
description: Validates that code changes affecting lists, selections, choosers, or UI visibility are reflected in rendered UI. Use when modifying option content, filtering, visibility rules, or adding/removing UI elements, or when the user asks to verify UI surfacing.
---

# Validate UI Surfacing

When changes may affect what users see in the UI, confirm the change is actually surfaced — not just correct in rules/data logic.

## When to Apply

Apply this skill when a change touches any of:

- List, dropdown, or chooser **option content** (added, removed, renamed, reordered)
- **Visibility** of a picker, section, tab, or control (show/hide logic)
- **Labels or headings** tied to a choice group
- **Pre-filled or auto-granted** values shown in the UI
- New or removed **UI elements** (buttons, tabs, panels, fields)

Skip when the change is purely internal (performance, refactors with identical output, non-UI APIs).

## Workflow

Copy this checklist and track progress:

```
UI surfacing validation:
- [ ] Step 1: Identify affected UI surfaces
- [ ] Step 2: Define expected visible state
- [ ] Step 3: Add or update automated checks
- [ ] Step 4: Run tests
- [ ] Step 5: Confirm no stale/absent UI
```

### Step 1: Identify affected UI surfaces

Map the code change to concrete UI outcomes:

| Change type | Verify in UI |
|-------------|--------------|
| Option pool changed | New/removed options appear in the chooser |
| Visibility rule changed | Picker/section appears or disappears for the right build state |
| Label or grouping changed | Heading/label text matches |
| Auto-grant or prefill changed | Granted values or slot defaults are shown |
| Element added/removed | Control/section present or absent in the right tab/context |

Note the **tab, section, and build state** required to see the element (class, selections, level, etc.).

### Step 2: Define expected visible state

Write explicit expectations before coding tests:

- **Present**: exact labels and option names that must appear
- **Absent**: labels/options/sections that must not appear
- **Count bounds**: e.g. "at least 2 options", "exactly 0 groups"

Prefer stable, user-visible strings (display names) over internal IDs in assertions.

### Step 3: Add or update automated checks

Use the project's two-layer pattern when both layers exist:

1. **Rules-layer mirror** — fast check that visibility/option logic matches what the UI component uses. Extract or extend mirror helpers that duplicate the component's filtering logic (see `tests/builder/builderChoiceVisibility.ts`).
2. **Render-layer check** — confirm the real component output contains the expected content. Use `renderToString` on the app component with a realistic `initialBuild` and `initialActiveTab` (see `tests/builder/characterBuilderRender.test.tsx`).

**Rules-only changes** (e.g. `src/rules/**`): add/update mirror tests in `tests/builder/priorityFixVisibility.test.ts` or a focused `*.test.ts` beside the rules change.

**Component changes** (e.g. `src/features/**`): add/update render tests in `tests/builder/characterBuilderRender.test.tsx` or the feature's test file.

**Both layers changed**: update both test files for the same scenario.

If mirror helpers do not yet exist for the affected surface, add a named mirror function with a comment citing the source component function it mirrors.

### Step 4: Run tests

```bash
npm test -- tests/builder/priorityFixVisibility.test.ts tests/builder/characterBuilderRender.test.tsx
```

Or run the narrowest test file that covers the change. All tests must pass before finishing.

### Step 5: Confirm no stale/absent UI

After tests pass, sanity-check:

- Removed options are **not** still rendered
- Newly visible pickers are **not** missing because of tab/state gating
- HTML entities in `renderToString` output (e.g. `&amp;`) — match encoded form in assertions

If automated coverage is impractical, document the manual repro steps (build state, tab, what to look for) in the PR or task summary.

## Test authoring conventions

- One scenario per `it(...)`, named for the user-visible outcome
- Use real rules index data (`generated/rules_index.json`) and realistic builds
- Stub browser globals when rendering (`localStorage`, `window`) — see `characterBuilderRender.test.tsx`
- Assert on **display names** users see, not raw IDs
- When fixing a reported gap, add a regression test that would have caught it

## Response expectations

When this skill applies, report:

1. Which UI surfaces were affected
2. What tests were added or updated (mirror, render, or both)
3. Test command run and result

## Additional resources

- Project-specific examples and mirror-helper patterns: [examples.md](examples.md)
