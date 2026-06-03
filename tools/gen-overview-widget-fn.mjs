import fs from "fs";

const src = fs.readFileSync("src/features/characterSheet/CharacterSheetApp.tsx", "utf8");
const lines = src.split(/\r?\n/);

function slice(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join("\n");
}

// 1-based line numbers from current CharacterSheetApp.tsx
const blocks = {
  character: [2150, 2222],
  abilityScores: [2223, 2244],
  racialTraits: [2247, 2287],
  classTraits: [2288, 2300],
  themeTraits: [2301, 2308],
  paragonTraits: [2309, 2316],
  epicTraits: [2317, 2324],
  feats: [2325, 2361],
  skills: [2364, 2386],
  speedInitiative: [2392, 2392], // single line renderSpeedInitiativePanel - will fix manually
  defenses: [2393, 2393],
  basicAttacks: [2394, 2394],
  hitPoints: [2398, 2398],
  conditions: [2401, 2401],
  powersAtWill: [2405, 2621] // entire power section - needs split per bucket
};

let out = `  function renderOverviewWidget(id: SheetWidgetId): ReactNode {\n    switch (id) {\n`;

for (const [id, [s, e]] of Object.entries(blocks)) {
  if (id.startsWith("powers")) continue;
  if (["speedInitiative", "defenses", "basicAttacks", "hitPoints", "conditions"].includes(id)) {
    const fn =
      id === "speedInitiative"
        ? "renderSpeedInitiativePanel()"
        : id === "defenses"
          ? "renderDefensesPanel()"
          : id === "basicAttacks"
            ? "renderAttackPreviewPanel()"
            : id === "hitPoints"
              ? "renderHitPointsPanel()"
              : "renderConditionsPanel()";
    out += `      case "${id}":\n        return (\n          <>\n            <WidgetPanelHeader title="${id}" layoutEditMode={layoutEditMode} />\n            {${fn}}\n          </>\n        );\n`;
    continue;
  }
  const body = slice(s, e).replace(/^              /gm, "          ");
  out += `      case "${id}":\n        return (\n${body}\n        );\n`;
}

out += `      case "powersAtWill":\n        return renderPowerBucket("atWill");\n`;
out += `      case "powersEncounter":\n        return renderPowerBucket("encounter");\n`;
out += `      case "powersDaily":\n        return renderPowerBucket("daily");\n`;
out += `      default:\n        return null;\n    }\n  }\n`;

fs.writeFileSync("src/features/characterSheet/_renderOverviewWidget.generated.txt", out);
console.log("wrote generated snippet, length", out.length);
