path = "src/features/characterSheet/CharacterSheetApp.tsx"
with open(path, encoding="utf-8") as f:
    s = f.read()

s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    "          ) : (\n          <>\n          <motion className=\"character-sheet-overview-rows\"",
)
s = s.replace(
    "          <motion className=\"character-sheet-overview-rows\"",
    "          <motion className=\"character-sheet-overview-rows\"",
)

# fix if above used wrong tag - use div explicitly
s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    "          ) : (\n          <>\n          <motion className=\"character-sheet-overview-rows\"",
)

# Actually use div
open_tag = "<" + "div"
s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    f"          ) : (\n          <>\n          {open_tag} className=\"character-sheet-overview-rows\"",
)
s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    f"          ) : (\n          <>\n          {open_tag} className=\"character-sheet-overview-rows\"",
)

# direct fix for actual file content
s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    "          ) : (\n          <>\n          <motion className=\"character-sheet-overview-rows\"",
)

# The file has div - do correct replace
s = s.replace(
    "          ) : (\n          <motion className=\"character-sheet-overview-rows\"",
    "          ) : (\n          <>\n          <motion className=\"character-sheet-overview-rows\"",
)

# Let me read and do line based
lines = s.splitlines()
for i, line in enumerate(lines):
    if line.strip() == ") : (" and i + 1 < len(lines) and "character-sheet-overview-rows" in lines[i + 1]:
        if "<>" not in lines[i + 1]:
            lines.insert(i + 1, "          <>")
        break

s = "\n".join(lines) + "\n"

s = s.replace(
    "          ))}\n          {showRaceHoverInfo",
    "          ))}\n          </>\n          )}\n          {showRaceHoverInfo",
)

# Fix classTraits case
s = s.replace(
    "return (          {showClassTraits && (",
    "return (\n          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={classTraitsSectionTitle}>\n              <TraitRowsList\n                rows={classTraitRows}\n                emptyMessage={traitsEmptyMessage(\n                  sheet.characterStyle === \"hybrid\" && hybridClassA && hybridClassB\n                    ? `${hybridClassA.name} / ${hybridClassB.name}`\n                    : derived.cls?.name,\n                  \"No class traits listed.\"\n                )}\n              />\n            </OverviewCollapsibleSection>\n          );\n        PLACEHOLDER_REMOVE",
)
# too hacky - fix class traits with regex
import re
s = re.sub(
    r'case "classTraits":\s*if \(!showClassTraits\) return null;\s*return \(\s*\{showClassTraits && \(\s*<OverviewCollapsibleSection layoutEditMode=\{layoutEditMode\} title=\{classTraitsSectionTitle\}>',
    'case "classTraits":\n        if (!showClassTraits) return null;\n        return (\n          <OverviewCollapsibleSection layoutEditMode={layoutEditMode} title={classTraitsSectionTitle}>',
    s,
    count=1,
)
for trait in ["themeTraits", "paragonTraits", "epicTraits"]:
    flag = {"themeTraits": "showThemeTraits", "paragonTraits": "showParagonTraits", "epicTraits": "showEpicDestinyTraits"}[trait]
    s = re.sub(
        rf'case "{trait}":\s*if \(!{flag}\) return null;\s*return \(\s*\{{{flag} && \(\s*<OverviewCollapsibleSection',
        f'case "{trait}":\n        if (!{flag}) return null;\n        return (\n          <OverviewCollapsibleSection',
        s,
        count=1,
    )
# Remove stray )}  before closing ); for trait sections
s = re.sub(r"\)\}\s*\);\s*case \"feats\"", ");\n      case \"feats\"", s)

# toolbar buttons
if "Customize layout" not in s:
    s = s.replace(
        """            <button type="button" onClick={refreshSavedCharacters}>
              Refresh Saved List
            </button>
          </div>
{layoutEditMode""",
        """            <button type="button" onClick={refreshSavedCharacters}>
              Refresh Saved List
            </button>
            {resolvedLayout.locked ? (
              <button type="button" onClick={unlockLayoutCustomize}>
                Customize layout
              </button>
            ) : (
              <>
                <button type="button" onClick={lockLayoutCustomize}>
                  Lock layout
                </button>
                <button type="button" onClick={resetSheetLayout}>
                  Reset to default
                </button>
              </>
            )}
          </div>
          {layoutEditMode""",
    )

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("done")
