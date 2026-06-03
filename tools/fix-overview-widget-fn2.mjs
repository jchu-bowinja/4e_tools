import fs from "fs";

let s = fs.readFileSync("src/features/characterSheet/_renderOverviewWidget.generated.txt", "utf8");
s = s.replace(/<OverviewCollapsibleSection/g, "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}");

for (const [id, flag] of [
  ["classTraits", "showClassTraits"],
  ["themeTraits", "showThemeTraits"],
  ["paragonTraits", "showParagonTraits"],
  ["epicTraits", "showEpicDestinyTraits"]
]) {
  const re = new RegExp(`case "${id}":\\s*return \\(\\s*\\{${flag} && \\(\\s*`, "s");
  s = s.replace(re, `case "${id}":\n        if (!${flag}) return null;\n        return (\n          `);
}

s = s.replace(/\)\}\s*\);\s*case "/g, ');\n      case "');

s = s.replace(
  /case "character":\s*return \(\s*<div style=\{\{ border:/s,
  `case "character":
        return (
          <>
            <WidgetPanelHeader title="Character" layoutEditMode={layoutEditMode} />
            {!layoutEditMode ? (
              <motion style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                Character
              </motion>
            ) : null}
          <div style={{ border:`
);

s = s.replace(
  /(\s*)<\/motion>\s*\);\s*case "abilityScores"/s,
  `$1</motion>
          </>
        );
      case "abilityScores"`
);

// Fix character closing - the character case ends with </motion> before abilityScores - need extra closing div and fragment
s = s.replace(
  /(\s*)<\/motion>\s*\);\s*case "abilityScores"/s,
  `$1</div>
          </>
        );
      case "abilityScores"`
);

// Actually character block ends with </motion> </motion> - let me read generated character end
// Line 77-78 is </motion> ); for character - only one closing div

s = s.replace(/<\/?motion\b/g, (x) => x.replace("motion", "div"));

const panelTitles = {
  speedInitiative: "Speed & Initiative",
  defenses: "Defenses",
  basicAttacks: "Basic Attacks",
  hitPoints: "Hit Points & Resources",
  conditions: "Conditions"
};
for (const [id, title] of Object.entries(panelTitles)) {
  s = s.replace(`title="${id}"`, `title="${title}"`);
}

fs.writeFileSync("src/features/characterSheet/_renderOverviewWidget.fixed.txt", s);
console.log("fixed", !s.includes("case themeTraits"));
