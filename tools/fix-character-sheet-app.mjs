import fs from "fs";

const path = "src/features/characterSheet/CharacterSheetApp.tsx";
let s = fs.readFileSync(path, "utf8");

// Remove duplicate power bucket header (orphaned props after first closing </motion>)
s = s.replace(
  /(\{layoutEditMode \? <SheetWidgetDragHandle \/> : null\}\s*<span>\{bucketLabel\}<\/span>\s*<\/div>)\s*onMouseEnter=\{\(event\) => glossaryTooltipUi\.startHover\(event, `powerUsage:\$\{bucket\}`\)\}[\s\S]*?\{bucket === "atWill" \? "At-Will" : bucket === "encounter" \? "Encounter" : "Daily"\}\s*<\/div>/,
  "$1"
);

// Fix character widget case: ensure fragment closes before abilityScores
if (s.includes('case "character":') && !s.includes("</>\n        );\n      case \"abilityScores\"")) {
  s = s.replace(
    /(case "character":[\s\S]*?<\/div>\s*<\/motion>\s*)\);\s*case "abilityScores"/,
    "$1</>\n        );\n      case \"abilityScores\""
  );
}

// Remove duplicate Character title inside character widget when WidgetPanelHeader exists
s = s.replace(
  /(WidgetPanelHeader title="Character" layoutEditMode=\{layoutEditMode\} \/>[\s\S]*?<div style=\{\{ border: "1px solid var\(--panel-border\)"[^}]+\}\}>)\s*<div style=\{\{ fontSize: "0\.72rem"[^]+?>\s*Character\s*<\/div>\s*/,
  "$1\n            "
);

fs.writeFileSync(path, s);
console.log("fixed");
