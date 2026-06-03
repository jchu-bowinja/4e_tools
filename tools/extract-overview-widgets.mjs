import fs from "fs";

const path = "src/features/characterSheet/CharacterSheetApp.tsx";
const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

// 0-based: character block starts ~2149, ends before overview-center column traits
const characterStart = lines.findIndex((l) => l.includes("fontSize: \"0.72rem\"") && l.includes("Character") && l.includes("textTransform"));
const characterEnd = lines.findIndex((l, i) => i > characterStart && l.trim() === "</motion>") + 1;
// fallback: find closing div of character block
let charEnd = characterStart;
let depth = 0;
for (let i = characterStart; i < lines.length; i++) {
  if (lines[i].includes("<div")) depth++;
  if (lines[i].includes("</div>")) {
    depth--;
    if (depth === 0 && i > characterStart + 5) {
      charEnd = i + 1;
      break;
    }
  }
}

console.log("character", characterStart + 1, charEnd);
