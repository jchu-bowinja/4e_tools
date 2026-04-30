import { describe, expect, it } from "vitest";
import { parseMonsterKeywordsFromXpHeaderLine, parsePastedMonsterTemplateTextLocal } from "./pasteMonsterTemplateEtl";

describe("parseMonsterKeywordsFromXpHeaderLine", () => {
  it("parses parenthetical comma-separated keywords before XP", () => {
    expect(parseMonsterKeywordsFromXpHeaderLine("(shapechanger, undead) XP Elite")).toEqual(["Shapechanger", "Undead"]);
    expect(parseMonsterKeywordsFromXpHeaderLine("(undead) XP Elite")).toEqual(["Undead"]);
    expect(parseMonsterKeywordsFromXpHeaderLine("(swarm) XP Elite")).toEqual(["Swarm"]);
  });

  it("parses bare XP tier line as no keywords", () => {
    expect(parseMonsterKeywordsFromXpHeaderLine("XP Elite")).toEqual([]);
  });

  it("parses type phrase or-list before XP", () => {
    expect(parseMonsterKeywordsFromXpHeaderLine("Humanoid or magical beast XP Elite")).toEqual(["Humanoid", "Magical Beast"]);
  });

  it("parses single type phrase before XP", () => {
    expect(parseMonsterKeywordsFromXpHeaderLine("Humanoid XP Elite")).toEqual(["Humanoid"]);
  });

  it("returns undefined for non-header lines", () => {
    expect(parseMonsterKeywordsFromXpHeaderLine("Defenses +2 AC")).toBeUndefined();
    expect(parseMonsterKeywordsFromXpHeaderLine("")).toBeUndefined();
  });
});

describe("paste import: template monster keywords", () => {
  it("stores keywords from the line after the role line (spawn / vampire / swarm)", () => {
    const spawn = parsePastedMonsterTemplateTextLocal(
      `Spawn of Kyuss
Prerequisites: None
Spawn of Kyuss Elite Soldier
(undead) XP Elite
Defenses +2 AC
Hit Points +8`,
      "Spawn of Kyuss"
    );
    expect(spawn.ok).toBe(true);
    if (!spawn.ok) return;
    expect(spawn.template.keywords).toEqual(["Undead"]);

    const vampire = parsePastedMonsterTemplateTextLocal(
      `Vampire Thrall Elite Brute
(shapechanger, undead) XP Elite
Defenses AC +2`,
      "Vampire Thrall"
    );
    expect(vampire.ok).toBe(true);
    if (!vampire.ok) return;
    expect(vampire.template.keywords?.sort()).toEqual(["Shapechanger", "Undead"]);

    const swarm = parsePastedMonsterTemplateTextLocal(
      `Swarm Shifter Elite Skirmisher
(swarm) XP Elite
Defenses Fortitude +2`,
      "Swarm Shifter"
    );
    expect(swarm.ok).toBe(true);
    if (!swarm.ok) return;
    expect(swarm.template.keywords).toEqual(["Swarm"]);
  });

  it("stores Humanoid or magical beast and Humanoid-only headers", () => {
    const ascetic = parsePastedMonsterTemplateTextLocal(
      `Ascetic of Vecna Elite Artillery
Humanoid or magical beast XP Elite
Defenses +2 Fortitude`,
      "Ascetic of Vecna"
    );
    expect(ascetic.ok).toBe(true);
    if (!ascetic.ok) return;
    expect(ascetic.template.keywords).toEqual(["Humanoid", "Magical Beast"]);

    const spectral = parsePastedMonsterTemplateTextLocal(
      `Spectral Assassin Elite Lurker
Humanoid XP Elite
Hit Points +6`,
      "Spectral Assassin"
    );
    expect(spectral.ok).toBe(true);
    if (!spectral.ok) return;
    expect(spectral.template.keywords).toEqual(["Humanoid"]);
  });

  it("stores empty keywords when the header line is only XP tier", () => {
    const mad = parsePastedMonsterTemplateTextLocal(
      `Victim of the Mad Dance Elite Skirmisher
XP Elite
Hit Points +8`,
      "Victim of the Mad Dance"
    );
    expect(mad.ok).toBe(true);
    if (!mad.ok) return;
    expect(mad.template.keywords).toEqual([]);
  });
});
