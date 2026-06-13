# UI Surfacing Examples (4e Builder)

## Mirror helper pattern

`tests/builder/builderChoiceVisibility.ts` exports functions that mirror `CharacterBuilderApp` logic:

| Mirror helper | Mirrors in CharacterBuilderApp |
|---------------|-------------------------------|
| `visiblePowerPickGroupsOnPowersTab` | `visibleNonSpellbookPowerGroupsOnPowersTab` |
| `visibleClassFeaturePickGroupsOnClassTab` | `visibleClassFeatureChoiceGroupsOnClassTab` |
| `autoGrantedClassPowerNames` | `classAutoGrantedPowers` |
| `themeGrantedPowerNames` | `themeGrantedPowers` |
| `essentialsBuildPrefilledSlotPowerNames` | Essentials build suggested slot prefill |

When adding a new chooser surface, add a mirror helper here first, then test it.

## Example: option pool change (rules layer)

Wizard selects Tome of Readiness → encounter power pool must include level-appropriate powers.

```typescript
const groups = visiblePowerPickGroupsOnPowersTab(rules, build);
const tomePick = groups.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_1511");
expect(tomePick).toBeDefined();
expect(tomePick!.optionNames).toContain("Burning Hands");
expect(tomePick!.optionNames.length).toBeGreaterThan(10);
```

## Example: visibility change (rules layer)

Warlock selects Infernal Pact → Hellish Rebuke variant pick appears on Powers tab.

```typescript
const groups = visiblePowerPickGroupsOnPowersTab(rules, build);
const infernalPick = groups.find((g) => g.key === "classPower:ID_FMP_CLASS_FEATURE_773");
expect(infernalPick).toBeDefined();
expect(infernalPick!.label).toBe("Infernal Pact");
expect(infernalPick!.optionNames).toEqual(
  expect.arrayContaining(["Hellish Rebuke", "Gift to Avernus"])
);
```

## Example: render-layer confirmation

Same scenario, verified in actual component HTML:

```typescript
const html = renderToString(
  <CharacterBuilderApp
    index={index}
    tooltipGlossary={{}}
    initialBuild={build}
    initialActiveTab="powers"
  />
);
expect(html).toContain("Infernal Pact");
expect(html).toContain("Hellish Rebuke");
expect(html).toContain("Gift to Avernus");
```

## Example: element removed from UI

When a pick should no longer appear for a build state, assert both:

```typescript
// Rules layer — group absent
expect(groups.find((g) => g.key === "classPower:OLD_KEY")).toBeUndefined();

// Render layer — label absent
expect(html).not.toContain("Removed Feature Label");
```

## Example: auto-granted content

Bloodsworn theme at level 1 shows granted power on Theme tab:

```typescript
const names = themeGrantedPowerNames(rules, build);
expect(names).toContain("Bloodied Determination");

// Render confirmation
expect(html).toContain("Bloodied Determination");
```

## Choosing mirror vs render

| Situation | Prefer |
|-----------|--------|
| Changed `src/rules/**` filtering or option resolution | Mirror test first |
| Changed component rendering or tab gating | Render test |
| User-reported "options missing in UI" bug | Both — mirror catches logic, render catches wiring |
| New chooser surface | Add mirror helper + mirror test, then one render smoke test |
