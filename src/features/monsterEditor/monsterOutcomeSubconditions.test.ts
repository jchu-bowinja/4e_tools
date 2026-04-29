import { describe, expect, it } from "vitest";
import { buildMonsterPowerCardViewModel } from "./monsterPowerCardViewModel";
import { enrichMonsterPowerOutcomes, splitSubconditionsFromDescription } from "./monsterOutcomeSubconditions";
import type { MonsterPower } from "./storage";

describe("splitSubconditionsFromDescription", () => {
  it("splits Failed Saving Throw from primary hit text", () => {
    const raw =
      "Burst 1; +3 vs Fort; 2d6 damage. Failed Saving Throw: Secondary attack vs adjacent creature; 2d6 damage.";
    const { primary, buckets } = splitSubconditionsFromDescription(raw);
    expect(primary).toContain("2d6 damage.");
    expect(primary).not.toContain("Failed Saving Throw");
    expect(buckets.failedSavingThrows).toHaveLength(1);
    expect(buckets.failedSavingThrows[0]?.description).toContain("adjacent");
  });

  it("prefers First Failed Saving Throw before Failed Saving Throw", () => {
    const raw = "Slowed (save ends). First Failed Saving Throw: Unconscious (save ends).";
    const { primary, buckets } = splitSubconditionsFromDescription(raw);
    expect(primary).toContain("Slowed");
    expect(buckets.failedSavingThrows[0]?.name?.toLowerCase()).toContain("first failed");
  });
});

describe("enrichMonsterPowerOutcomes", () => {
  it("moves inline failed save from hit.description into failedSavingThrows", () => {
    const power: MonsterPower = {
      name: "Test",
      usage: "At-Will",
      action: "Standard",
      keywords: "",
      description: "",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Attack",
          hit: {
            description:
              "Ongoing 5 (save ends). Failed Saving Throw: 5 extra damage."
          }
        }
      ]
    };
    const out = enrichMonsterPowerOutcomes(power);
    expect(out.attacks?.[0]?.hit?.description?.trim()).toContain("Ongoing 5");
    expect(out.attacks?.[0]?.hit?.description?.includes("Failed Saving Throw")).toBe(false);
    expect(out.attacks?.[0]?.hit?.failedSavingThrows?.[0]?.description).toContain("5 extra");
  });

  it("drops redundant MonsterAttackEntry stubs", () => {
    const power: MonsterPower = {
      name: "Test",
      usage: "At-Will",
      action: "Standard",
      keywords: "",
      description: "",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Attack",
          hit: { description: "Damage.", failedSavingThrows: [{ kind: "MonsterAttackEntry", description: "Extra" }] }
        },
        { kind: "MonsterAttackEntry", name: "Each Failed Saving Throw" }
      ]
    };
    const out = enrichMonsterPowerOutcomes(power);
    expect(out.attacks).toHaveLength(1);
  });
});

describe("buildMonsterPowerCardViewModel ongoing line", () => {
  it("does not put Failed Saving Throw clause into ONGOING banner", () => {
    const power: MonsterPower = {
      name: "Test",
      usage: "At-Will",
      action: "Standard",
      keywords: "",
      description:
        "Area burst; hit for damage and ongoing 5 necrotic damage (save ends). Failed Saving Throw: Make an attack vs. Fort."
    };
    const vm = buildMonsterPowerCardViewModel(power);
    expect(vm.ongoingText.toLowerCase()).toContain("necrotic");
    expect(vm.ongoingText.toLowerCase()).not.toContain("failed saving throw");
    expect(vm.ongoingText.toLowerCase()).not.toContain("make an attack");
  });
});
