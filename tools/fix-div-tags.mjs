import fs from "fs";
const path = "src/features/characterSheet/CharacterSheetApp.tsx";
let s = fs.readFileSync(path, "utf8");
const wrongClose = "</" + "mo" + "tion>";
const rightClose = "</" + "div>";
let count = 0;
while (s.includes(wrongClose)) {
  s = s.replace(wrongClose, rightClose);
  count++;
}
fs.writeFileSync(path, s);
console.log("replaced", count, "tags");
