import { describe, expect, it } from "vitest";
import {
  buildEncounterPrintCreatureListLines,
  combatRoleForPrint,
  effectiveEncounterRowLevel,
  mergeEncounterPrintBreakIdsForDedupedCards
} from "./encounterPrintRosterComposition";
import type { EncounterRosterRow } from "./encounterStorage";
import type { MonsterEntryFile } from "../monsterEditor/storage";

function snap(partial: Partial<MonsterEntryFile> & Pick<MonsterEntryFile, "role">): MonsterEntryFile {
  return {
    id: "t",
    fileName: "t",
    relativePath: "t",
    name: "T",
    level: 3,
    parseError: "",
    sourceRoot: "",
    size: "M",
    origin: "",
    type: "natural",
    xp: 0,
    stats: { abilityScores: {}, defenses: {}, attackBonuses: {}, skills: {}, otherNumbers: {} },
    powers: [],
    ...partial
  } as MonsterEntryFile;
}

function row(
  id: string,
  partial: Partial<MonsterEntryFile> & Pick<MonsterEntryFile, "role">,
  extras?: Pick<EncounterRosterRow, "levelAdjustment">
): EncounterRosterRow {
  return {
    rosterInstanceId: id,
    sourceMonsterId: "s",
    snapshot: snap(partial),
    ...(extras?.levelAdjustment !== undefined ? { levelAdjustment: extras.levelAdjustment } : {})
  };
}

describe("effectiveEncounterRowLevel", () => {
  it("base + clamped adjustment", () => {
    const r = row("a", { role: "Brute", level: 5 }, { levelAdjustment: 2 });
    expect(effectiveEncounterRowLevel(r)).toBe(7);
  });
});

describe("combatRoleForPrint", () => {
  it("strips duplicate elite prefix", () => {
    expect(combatRoleForPrint(snap({ role: "Elite Skirmisher" }))).toBe("Skirmisher");
  });
});

describe("mergeEncounterPrintBreakIdsForDedupedCards", () => {
  it("maps breaks on duplicate rows to canonical first id", () => {
    const rows = [
      row("a", { role: "Artillery", name: "Same", level: 5 }),
      row("b", { role: "Artillery", name: "Same", level: 5 })
    ];
    const merged = mergeEncounterPrintBreakIdsForDedupedCards(rows, new Set(["b"]));
    expect([...merged]).toEqual(["a"]);
  });
});

describe("buildEncounterPrintCreatureListLines", () => {
  it("empty roster", () => {
    expect(buildEncounterPrintCreatureListLines([])).toEqual([]);
  });

  it("one standard creature", () => {
    expect(buildEncounterPrintCreatureListLines([row("a", { role: "Brute", name: "Orc" })])).toEqual([
      "1 x Orc Level 3 Standard Brute"
    ]);
  });

  it("solo controller", () => {
    const lines = buildEncounterPrintCreatureListLines([
      row("a", { role: "Controller", groupRole: "Solo", name: "Blackfire Dracolich", level: 23 })
    ]);
    expect(lines).toEqual(["1 x Blackfire Dracolich Level 23 Solo Controller"]);
  });

  it("elite controller leader", () => {
    const lines = buildEncounterPrintCreatureListLines([
      row("a", {
        role: "Controller",
        groupRole: "Elite",
        name: "Kuyutha, Exarch of Bahamut",
        level: 23,
        isLeader: true
      })
    ]);
    expect(lines).toEqual(["1 x Kuyutha, Exarch of Bahamut Level 23 Elite Controller (Leader)"]);
  });

  it("merges identical display rows", () => {
    const lines = buildEncounterPrintCreatureListLines([
      row("1", { role: "Artillery", name: "Blackstar Annihilator", level: 23 }),
      row("2", { role: "Artillery", name: "Blackstar Annihilator", level: 23 }),
      row("3", { role: "Artillery", name: "Blackstar Annihilator", level: 23 })
    ]);
    expect(lines).toEqual(["3 x Blackstar Annihilator Level 23 Standard Artillery"]);
  });

  it("does not merge different levels", () => {
    const lines = buildEncounterPrintCreatureListLines([
      row("1", { role: "Artillery", name: "Blackstar Annihilator", level: 22 }),
      row("2", { role: "Artillery", name: "Blackstar Annihilator", level: 23 })
    ]);
    expect(lines).toEqual([
      "1 x Blackstar Annihilator Level 22 Standard Artillery",
      "1 x Blackstar Annihilator Level 23 Standard Artillery"
    ]);
  });
});
