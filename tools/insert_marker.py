path = "src/features/characterSheet/CharacterSheetApp.tsx"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

def insert_before(line_substr, marker):
    for i, line in enumerate(lines):
        if line_substr in line and marker not in lines[i - 1] if i > 0 else True:
            lines.insert(i, f"              {{/* {marker} */}}\n")
            return i
    raise SystemExit(f"not found: {line_substr}")

insert_before('border: "1px solid var(--panel-border)", borderRadius: "0.4rem", padding: "0.55rem", backgroundColor: "var(--surface-0)", display: "grid", gap: "0.35rem", boxShadow: "inset 0 0 0 1px var(--surface-2)"', "W:character")
insert_before('title="Ability Scores"', "W:abilityScores")
insert_before("title={racialTraitsSectionTitle}", "W:racialTraits")
insert_before("title={classTraitsSectionTitle}", "W:classTraits")
insert_before("title={themeTraitsSectionTitle}", "W:themeTraits")
insert_before("title={paragonTraitsSectionTitle}", "W:paragonTraits")
insert_before("title={epicDestinyTraitsSectionTitle}", "W:epicTraits")
insert_before('title="Feats"', "W:feats")
insert_before('title="Skills"', "W:skills")
insert_before("{renderSpeedInitiativePanel()}", "W:speedInitiative")
insert_before("{renderDefensesPanel()}", "W:defenses")
insert_before("{renderAttackPreviewPanel()}", "W:basicAttacks")
insert_before("{renderHitPointsPanel()}", "W:hitPoints")
insert_before("{renderConditionsPanel()}", "W:conditions")
insert_before('onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerUsage:${bucket}`)', "W:powers")

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("markers inserted")
