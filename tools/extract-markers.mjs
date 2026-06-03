import fs from "fs";

const app = fs.readFileSync("src/features/characterSheet/CharacterSheetApp.tsx", "utf8");
const d = "div";

function extract(marker) {
  const start = app.indexOf(`{/* W:${marker} */}`);
  if (start < 0) throw new Error(`missing W:${marker}`);
  const end = app.indexOf("{/* W:", start + 10);
  let chunk = app.slice(start, end > start ? end : app.length);
  chunk = chunk.replace(`{/* W:${marker} */}\n`, "");
  return chunk
    .split("\n")
    .map((l) => l.replace(/^              /, "          "))
    .join("\n")
    .trim();
}

const widgets = [
  "character",
  "abilityScores",
  "racialTraits",
  "classTraits",
  "themeTraits",
  "paragonTraits",
  "epicTraits",
  "feats",
  "skills"
];

let out = `  function renderOverviewWidget(id: SheetWidgetId): ReactNode {\n    switch (id) {\n`;

for (const w of widgets) {
  let body = extract(w);
  body = body.replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}");
  if (w === "character") {
    body = `          <>
            <WidgetPanelHeader title="Character" layoutEditMode={layoutEditMode} />
            ${body.replace(
              `<${d} style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Character
                </${d}>`,
              ""
            )}
          </>`;
  }
  if (["classTraits", "themeTraits", "paragonTraits", "epicTraits"].includes(w)) {
    const flag =
      w === "classTraits"
        ? "showClassTraits"
        : w === "themeTraits"
          ? "showThemeTraits"
          : w === "paragonTraits"
            ? "showParagonTraits"
            : "showEpicDestinyTraits";
    out += `      case "${w}":\n        if (!${flag}) return null;\n        return (\n${body}\n        );\n`;
  } else {
    out += `      case "${w}":\n        return (\n${body}\n        );\n`;
  }
}

const panelWidgets = [
  ["speedInitiative", "Speed & Initiative", "renderSpeedInitiativePanel()"],
  ["defenses", "Defenses", "renderDefensesPanel()"],
  ["basicAttacks", "Basic Attacks", "renderAttackPreviewPanel()"],
  ["hitPoints", "Hit Points & Resources", "renderHitPointsPanel()"],
  ["conditions", "Conditions", "renderConditionsPanel()"]
];
for (const [id, title, fn] of panelWidgets) {
  out += `      case "${id}":\n        return (\n          <>\n            <WidgetPanelHeader title="${title}" layoutEditMode={layoutEditMode} />\n            {${fn}}\n          </>\n        );\n`;
}

out += `      case "powersAtWill":\n        return renderPowerBucket("atWill");\n`;
out += `      case "powersEncounter":\n        return renderPowerBucket("encounter");\n`;
out += `      case "powersDaily":\n        return renderPowerBucket("daily");\n`;
out += `      default:\n        return null;\n    }\n  }\n`;

fs.writeFileSync("src/features/characterSheet/_renderOverviewWidget.from-markers.txt", out);
console.log("ok", out.length);
