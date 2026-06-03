import fs from "fs";

const path = "src/features/characterSheet/CharacterSheetApp.tsx";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines
    .slice(start - 1, end)
    .map((l) => l.replace(/^              /, "          "))
    .join("\n");
}

const d = "d" + "iv";
const powerInner = lines
  .slice(2347, 2543)
  .map((l) => l.replace(/^                /, "        "))
  .join("\n")
  .replace(/^\s*draggable$/m, "        draggable={!layoutEditMode}");

const classTraitsBody = `          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={classTraitsSectionTitle}>
            <TraitRowsList
              rows={classTraitRows}
              emptyMessage={traitsEmptyMessage(
                sheet.characterStyle === "hybrid" && hybridClassA && hybridClassB
                  ? \`\${hybridClassA.name} / \${hybridClassB.name}\`
                  : derived.cls?.name,
                "No class traits listed."
              )}
            />
          </OverviewCollapsibleSection>`;

const widgetFn = `  function renderOverviewWidget(id: SheetWidgetId): ReactNode {
    switch (id) {
      case "character":
        return (
          <>
            <WidgetPanelHeader title="Character" layoutEditMode={layoutEditMode} />
            <${d} style={{ border: "1px solid var(--panel-border)", borderRadius: "0.4rem", padding: "0.55rem", backgroundColor: "var(--surface-0)", display: "grid", gap: "0.35rem", boxShadow: "inset 0 0 0 1px var(--surface-2)" }}>
              ${slice(2077, 2144)}
            </${d}>
          </>
        );
      case "abilityScores":
        return (${slice(2146, 2167).replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}")});
      case "racialTraits":
        return (${slice(2170, 2210).replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}")});
      case "classTraits":
        if (!showClassTraits) return null;
        return (${classTraitsBody});
      case "themeTraits":
        if (!showThemeTraits) return null;
        return (
          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={themeTraitsSectionTitle}>
            <TraitRowsList
              rows={themeTraitRows}
              emptyMessage={traitsEmptyMessage(selectedTheme?.name, "No theme traits listed.")}
            />
          </OverviewCollapsibleSection>
        );
      case "paragonTraits":
        if (!showParagonTraits) return null;
        return (
          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={paragonTraitsSectionTitle}>
            <TraitRowsList
              rows={paragonTraitRows}
              emptyMessage={traitsEmptyMessage(selectedParagonPath?.name, "No paragon traits listed.")}
            />
          </OverviewCollapsibleSection>
        );
      case "epicTraits":
        if (!showEpicDestinyTraits) return null;
        return (
          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={epicDestinyTraitsSectionTitle}>
            <TraitRowsList
              rows={epicDestinyTraitRows}
              emptyMessage={traitsEmptyMessage(selectedEpicDestiny?.name, "No epic destiny traits listed.")}
            />
          </OverviewCollapsibleSection>
        );
      case "feats":
        return (${slice(2248, 2284).replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}")});
      case "skills":
        return (${slice(2287, 2309).replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}")});
      case "speedInitiative":
        return (<><WidgetPanelHeader title="Speed & Initiative" layoutEditMode={layoutEditMode} />{renderSpeedInitiativePanel()}</>);
      case "defenses":
        return (<><WidgetPanelHeader title="Defenses" layoutEditMode={layoutEditMode} />{renderDefensesPanel()}</>);
      case "basicAttacks":
        return (<><WidgetPanelHeader title="Basic Attacks" layoutEditMode={layoutEditMode} />{renderAttackPreviewPanel()}</>);
      case "hitPoints":
        return (<><WidgetPanelHeader title="Hit Points & Resources" layoutEditMode={layoutEditMode} />{renderHitPointsPanel()}</>);
      case "conditions":
        return (<><WidgetPanelHeader title="Conditions" layoutEditMode={layoutEditMode} />{renderConditionsPanel()}</>);
      case "powersAtWill":
        return renderPowerBucket("atWill");
      case "powersEncounter":
        return renderPowerBucket("encounter");
      case "powersDaily":
        return renderPowerBucket("daily");
      default:
        return null;
    }
  }`;

const powerBucketFn = `  type PowerBucket = "atWill" | "encounter" | "daily";

  function renderPowerBucket(bucket: PowerBucket): JSX.Element {
    const bucketLabel = bucket === "atWill" ? "At-Will" : bucket === "encounter" ? "Encounter" : "Daily";
    return (
      <>
        <${d}
          className={layoutEditMode ? "character-sheet-widget-drag-handle" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontWeight: 700,
            marginBottom: "0.35rem",
            borderLeft: \`5px solid \${usageAccentColor(bucket)}\`,
            paddingLeft: "0.45rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-primary)",
            cursor: layoutEditMode ? "move" : undefined
          }}
          onMouseEnter={(event) => glossaryTooltipUi.startHover(event, \`powerUsage:\${bucket}\`)}
          onMouseLeave={glossaryTooltipUi.leaveHover}
          onFocus={(event) => glossaryTooltipUi.startHover(event, \`powerUsage:\${bucket}\`)}
          onBlur={glossaryTooltipUi.leaveHover}
          tabIndex={0}
        >
          {layoutEditMode ? <SheetWidgetDragHandle /> : null}
          <span>{bucketLabel}</span>
        </${d}>
${powerInner}
      </>
    );
  }`;

let app = lines.join("\n");

// module patches
app = app.replace(
  'import { createDefaultCharacterSheetState } from "./defaultState";\nimport type { CharacterSheetState, EquipmentSlot, InventoryItem } from "./model";',
  `import { CharacterSheetOverviewLayout } from "./CharacterSheetOverviewLayout";\nimport { createDefaultCharacterSheetState } from "./defaultState";\nimport { createDefaultSheetLayout } from "./defaultSheetLayout";\nimport { resolveSheetLayout } from "./layoutNormalize";\nimport type { CharacterSheetLayout, CharacterSheetState, EquipmentSlot, InventoryItem, SheetWidgetId } from "./model";`
);

const helpers = `
function SheetWidgetDragHandle(): JSX.Element {
  return (
    <span className="character-sheet-widget-drag-handle" aria-hidden title="Drag to move section">
      {"\\u22EE\\u22EE"}
    </span>
  );
}

function layoutSectionSummary(title: string, layoutEditMode?: boolean): ReactNode {
  if (!layoutEditMode) return title;
  return (
    <>
      <SheetWidgetDragHandle />
      {title}
    </>
  );
}

function WidgetPanelHeader({ title, layoutEditMode }: { title: string; layoutEditMode?: boolean }): JSX.Element | null {
  if (!layoutEditMode) return null;
  return (
    <${d}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        marginBottom: "0.35rem",
        fontSize: "0.72rem",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 700
      }}
    >
      <SheetWidgetDragHandle />
      {title}
    </${d}>
  );
}
`;

app = app.replace(
  "  children: ReactNode;\n};\n\nfunction traitsSectionTitle",
  `  layoutEditMode?: boolean;\n  children: ReactNode;\n};\n${helpers}\nfunction traitsSectionTitle`
);
app = app.replace(
  "function OverviewCollapsibleSection({\n  title,\n  shellStyle,\n  titleTabIndex,",
  "function OverviewCollapsibleSection({\n  title,\n  shellStyle,\n  titleTabIndex,\n  layoutEditMode,"
);
app = app.replace(
  "      summary={title}\n      summaryTabIndex={titleTabIndex}",
  "      summary={layoutSectionSummary(title, layoutEditMode)}\n      summaryTabIndex={titleTabIndex}"
);
app = app.replace(
  "  function updateSheet(mutator: (prev: CharacterSheetState) => CharacterSheetState): void {\n    setSheet((prev) => mutator(prev));\n  }",
  `  function updateSheet(mutator: (prev: CharacterSheetState) => CharacterSheetState): void {
    setSheet((prev) => mutator(prev));
  }

  const resolvedLayout = useMemo(() => resolveSheetLayout(sheet.layout), [sheet.layout]);
  const layoutEditMode = !resolvedLayout.locked;

  function handleOverviewLayoutChange(next: CharacterSheetLayout): void {
    updateSheet((prev) => ({ ...prev, layout: next }));
  }

  function unlockLayoutCustomize(): void {
    updateSheet((prev) => ({
      ...prev,
      layout: { ...resolveSheetLayout(prev.layout), locked: false }
    }));
  }

  function lockLayoutCustomize(): void {
    updateSheet((prev) => ({
      ...prev,
      layout: { ...resolveSheetLayout(prev.layout), locked: true }
    }));
  }

  function resetSheetLayout(): void {
    if (!window.confirm("Reset the character sheet layout to default positions?")) {
      return;
    }
    updateSheet((prev) => ({ ...prev, layout: createDefaultSheetLayout(true) }));
  }`
);

const stopIdx = app.indexOf("function stopClassHoverInfoTimerAndHide");
const returnLine = app.lastIndexOf("  return (", app.indexOf('padding: "clamp(0.65rem, 1.4vw, 1rem)"', stopIdx));
app = app.slice(0, returnLine) + powerBucketFn + "\n" + widgetFn + "\n" + app.slice(returnLine);

const overviewStart = app.indexOf('          <div className="character-sheet-overview-rows"');
const powerEndMarker = "                })()}\n            </" + d + ">\n          ))}";
const powerEnd = app.indexOf(powerEndMarker, overviewStart);
if (powerEnd === -1) {
  throw new Error("Could not find end of overview power section");
}
const powerEndLine = powerEnd + powerEndMarker.length;
const legacyBlock = app.slice(overviewStart, powerEndLine);

const layoutBlock = `{layoutEditMode ? (
            <>
              <p
                className="character-sheet-layout-hint"
                style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", gridColumn: "1 / -1" }}
              >
                Drag section headers to rearrange. Drag corners to resize. Power card reorder is disabled while customizing.
              </p>
              <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                <CharacterSheetOverviewLayout
                  layout={resolvedLayout}
                  renderWidget={renderOverviewWidget}
                  onLayoutChange={handleOverviewLayoutChange}
                />
              </${d}>
            </>
          ) : (
          <>
${legacyBlock}          </>
          )}`;

app = app.slice(0, overviewStart) + layoutBlock + app.slice(powerEndLine);

const toolbarReplacement = [
  `            <button type="button" onClick={refreshSavedCharacters}>
              Refresh Saved List
            </button>
            {resolvedLayout.locked ? (
              <button type="button" onClick={unlockLayoutCustomize}>Customize layout</button>
            ) : (
              <>
                <button type="button" onClick={lockLayoutCustomize}>Lock layout</button>
                <button type="button" onClick={resetSheetLayout}>Reset to default</button>
              </>
            )}
          `,
  "</",
  d,
  ">"
].join("");

app = app.replace(
  `            <button type="button" onClick={refreshSavedCharacters}>
              Refresh Saved List
            </button>
          </div>`,
  toolbarReplacement
);

app = app.replace(
  '<OverviewCollapsibleSection title="Basic Attacks">',
  '<OverviewCollapsibleSection layoutEditMode={layoutEditMode} title="Basic Attacks">'
);

fs.writeFileSync(path, app);
console.log("v2 applied");
