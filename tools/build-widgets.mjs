import fs from "fs";

const app = fs.readFileSync("src/features/characterSheet/CharacterSheetApp.tsx", "utf8");

function slice(start, end) {
  const s = app.indexOf(start);
  const e = app.indexOf(end, s);
  if (s < 0 || e < 0) throw new Error(`slice failed: ${start.slice(0, 40)}`);
  return app.slice(s, e).replace(/^              /gm, "          ");
}

const character = slice(
  '<motion style={{ fontSize: "0.72rem", color: "var(--text-muted)"',
  '<OverviewCollapsibleSection\n                title="Ability Scores"'
).replace('<motion', '<motion').replace('fontSize: "0.72rem"', 'fontSize: "0.72rem"');

// use div not motion - fix after
let characterBlock = slice(
  '<motion style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase"',
  '<OverviewCollapsibleSection\n                title="Ability Scores"'
);

// Try with div
characterBlock = slice(
  'fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>\n                  Character',
  '<OverviewCollapsibleSection\n                title="Ability Scores"'
);

console.log("character len", characterBlock.length);
