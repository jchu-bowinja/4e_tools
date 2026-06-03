path = "src/features/characterSheet/CharacterSheetApp.tsx"
open_tag = "<" + "d" + "i" + "v"
close_tag = "<" + "/" + "d" + "i" + "v" + ">"
wrong_open = "<" + "m" + "o" + "t" + "i" + "o" + "n"
wrong_close = "<" + "/" + "m" + "o" + "t" + "i" + "o" + "n" + ">"

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

lines[163] = lines[163].replace(wrong_open, open_tag)
lines[178] = lines[178].replace(wrong_close, close_tag)

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("ok")
