import fs from "fs";

let out = fs.readFileSync("src/features/characterSheet/_renderOverviewWidget.generated.txt", "utf8");

out = out.replace(
  /<OverviewCollapsibleSection/g,
  "<OverviewCollapsibleSection layoutEditMode={layoutEditMode}"
);

const conditionalCases = ["classTraits", "themeTraits", "paragonTraits", "epicTraits"];
for (const id of conditionalCases) {
  const flag =
    id === "classTraits"
      ? "showClassTraits"
      : id === "themeTraits"
        ? "showThemeTraits"
        : id === "paragonTraits"
          ? "showParagonTraits"
          : "showEpicDestinyTraits";
  out = out.replace(
    new RegExp(`case "${id}":\\s*return \\(\\s*\\{${flag} && \\(`),
    `case "${id}":\n        if (!${flag}) return null;\n        return (`
  );
  out = out.replace(/\)\}\s*\);\s*case "/g, ");\n      case ");
}

// character header drag handle
out = out.replace(
  `            <motion style={{ fontSize: "0.72rem"`,
  `            <WidgetPanelHeader title="Character" layoutEditMode={layoutEditMode} />\n            <motion style={{ fontSize: "0.72rem"`
);
out = out.replace(
  `<motion style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>\n              Character\n            </motion>`,
  ""
);

// fix mistaken motion -> should be div if any
out = out.replace(/<\/?motion\b/g, (m) => m.replace("motion", "motion"));

fs.writeFileSync("src/features/characterSheet/_renderOverviewWidget.fixed.txt", out);
