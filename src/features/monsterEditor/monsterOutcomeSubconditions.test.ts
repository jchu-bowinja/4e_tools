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

  it("shows attack bonus as level + bonus for template-style level-based attacks", () => {
    const power: MonsterPower = {
      name: "Creeping Rot",
      usage: "Recharge",
      action: "Standard",
      keywords: "Necrotic",
      description:
        "Area burst 2 within 10; ascetic of Vecna's level + 3 vs. Fortitude; 3d6 necrotic damage.",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Hit",
          attackBonuses: [{ defense: "Fortitude", bonus: 3 }],
          hit: { description: "3d6 necrotic damage." }
        }
      ]
    };
    const vm = buildMonsterPowerCardViewModel(power);
    expect(vm.attackLineParts.join(" ")).toContain("level + 3 vs fortitude");
  });

  it("keeps plain numeric attack bonus display when not level-based text", () => {
    const power: MonsterPower = {
      name: "Longsword",
      usage: "At-Will",
      action: "Standard",
      keywords: "Weapon",
      description: "Melee 1; 1d8 + 4 damage.",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Hit",
          attackBonuses: [{ defense: "AC", bonus: 3 }],
          hit: { description: "1d8 + 4 damage." }
        }
      ]
    };
    const vm = buildMonsterPowerCardViewModel(power);
    expect(vm.attackLineParts.join(" ")).toContain("3 vs ac");
    expect(vm.attackLineParts.join(" ")).not.toContain("level + 3");
  });

  it("keeps nested attack outcomes grouped by indentation depth", () => {
    const power: MonsterPower = {
      name: "Chain Lightning",
      usage: "Recharge",
      action: "Standard",
      keywords: "Lightning",
      description: "",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Primary",
          hit: {
            description: "2d8 lightning damage.",
            nestedAttackDescriptions: [
              {
                description: "Secondary target takes 1d8 lightning damage.",
                failedSavingThrows: [{ description: "Target is dazed (save ends)." }]
              }
            ]
          }
        }
      ]
    };
    const vm = buildMonsterPowerCardViewModel(power);
    const nestedAttack = vm.outcomeLines.find((line) => line.label === "ATTACK");
    const nestedFailedSave = vm.outcomeLines.find((line) => line.label === "FAILED SAVE" && line.indentLevel != null);
    expect(nestedAttack?.indentLevel).toBe(1);
    expect(nestedFailedSave?.indentLevel).toBe(2);
  });

  it("drops duplicate ATTACK lines when secondary HIT already carries same effect text", () => {
    const repeatedTail =
      "the target is slowed (save ends). Whenever the target ends its turn more than 5 squares away from the primary target while it is slowed, it takes 5 lightning damage and the mage knocks the target prone.";
    const power: MonsterPower = {
      name: "Brilliant Chains",
      usage: "Encounter",
      action: "Standard",
      keywords: "Implement lightning",
      description: "",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Primary Attack",
          targets: "one creature",
          hit: {
            description: "1d8 + 4 lightning damage, and the mage makes a secondary attack.",
            nestedAttackDescriptions: [`lightning damage, and ${repeatedTail}`]
          }
        },
        {
          kind: "MonsterAttack",
          name: "Secondary Attack",
          targets: "two creatures within 5 squares of the primary target",
          hit: {
            description: `4 lightning damage, and ${repeatedTail}`
          }
        }
      ]
    };
    const vm = buildMonsterPowerCardViewModel(power);
    expect(vm.outcomeLines.some((line) => line.label === "ATTACK")).toBe(false);
    expect(vm.secondaryAttacks[0]?.outcomeLines.some((line) => line.label === "HIT")).toBe(true);
  });

  it("drops duplicate ATTACK lines for multi-type damage summaries mirrored by secondary HIT", () => {
    const power: MonsterPower = {
      name: "Chaotic Tome",
      usage: "At-Will",
      action: "Standard",
      keywords: "",
      description: "",
      attacks: [
        {
          kind: "MonsterAttack",
          name: "Effect",
          effect: {
            description: "Roll a d6 to determine which of the following powers Rort uses:",
            nestedAttackDescriptions: [
              "lightning and necrotic damage, and the target is dazed (save ends).",
              "acid and fire damage."
            ]
          }
        },
        {
          kind: "MonsterAttack",
          name: "Attack",
          hit: {
            description: "1d8 + 3 lightning and necrotic damage, and the target is dazed (save ends)."
          }
        },
        {
          kind: "MonsterAttack",
          name: "Attack",
          hit: { description: "2d10 + 3 acid and fire damage." }
        }
      ]
    };
    const vm = buildMonsterPowerCardViewModel(power);
    expect(vm.outcomeLines.some((line) => line.label === "ATTACK")).toBe(false);
    expect(vm.secondaryAttacks).toHaveLength(2);
  });
});
