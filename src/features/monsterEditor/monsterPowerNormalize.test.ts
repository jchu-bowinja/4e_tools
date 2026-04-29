import { describe, expect, it } from "vitest";
import { normalizeMonsterPowerShape } from "./monsterPowerNormalize";
import type { MonsterPower } from "./storage";

describe("normalizeMonsterPowerShape", () => {
  it("hydrates keyword arrays from keyword string", () => {
    const raw: MonsterPower = {
      name: "Creeping Rot",
      usage: "Recharge",
      action: "Standard",
      keywords: "Necrotic, Disease",
      description: "Area burst 2 within 10; level + 3 vs. Fortitude; 3d6 necrotic damage."
    } as MonsterPower;
    const normalized = normalizeMonsterPowerShape(raw);
    expect(normalized.keywordTokens).toEqual(["Necrotic", "Disease"]);
    expect(normalized.keywordNames).toEqual(["Necrotic", "Disease"]);
  });

  it("infers attack bonuses and damage expressions from description", () => {
    const raw = {
      name: "Rot Burst",
      usage: "At-Will",
      action: "Standard",
      keywords: "",
      description: "Close burst 1; level + 2 vs. Reflex; 2d6 + 4 necrotic damage."
    } as MonsterPower;
    const normalized = normalizeMonsterPowerShape(raw);
    expect(normalized.attacks?.[0]?.attackBonuses?.[0]).toEqual({ defense: "Reflex", bonus: "level + 2" });
    expect(normalized.damageExpressions).toContain("2d6 + 4 necrotic");
  });
});
