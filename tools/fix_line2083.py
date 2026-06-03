path = "src/features/characterSheet/CharacterSheetApp.tsx"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if line.strip() == "</motion>" and i > 2070 and i < 2090:
        lines[i] = "          </div>\n"
        print("fixed line", i + 1)
        break
with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
