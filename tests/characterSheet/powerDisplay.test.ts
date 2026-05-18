import { describe, expect, it } from "vitest";
import { buildPowerDisplaySections, getPowerActionType, normalizePowerGroupBy } from "../../src/features/characterSheet/powerDisplay";
import type { GroupedPowerCards } from "../../src/features/characterSheet/selectors";
import type { Power } from "../../src/rules/models";

function power(id: string, name: string, usage: string, actionType: string): Power {
  return {
    id,
    name,
    slug: id,
    usage,
    level: 1,
    raw: { specific: { "Action Type": actionType } }
  };
}

const grouped: GroupedPowerCards = {
  atWill: [power("aw_std", "At-Will Standard", "At-Will", "Standard Action")],
  encounter: [power("enc_minor", "Encounter Minor", "Encounter", "Minor Action")],
  daily: [power("daily_move", "Daily Move", "Daily", "Move Action")]
};

describe("normalizePowerGroupBy", () => {
  it("defaults unknown values to usage", () => {
    expect(normalizePowerGroupBy(undefined)).toBe("usage");
    expect(normalizePowerGroupBy("actionType")).toBe("actionType");
    expect(normalizePowerGroupBy("invalid")).toBe("usage");
  });
});

describe("buildPowerDisplaySections", () => {
  it("groups by usage buckets", () => {
    const sections = buildPowerDisplaySections(grouped, "usage");
    expect(sections.map((section) => section.key)).toEqual(["atWill", "encounter", "daily"]);
    expect(sections[0]?.powers.map((p) => p.id)).toEqual(["aw_std"]);
  });

  it("groups by action type with standard ordering", () => {
    const sections = buildPowerDisplaySections(grouped, "actionType");
    expect(sections.map((section) => section.title)).toEqual(["Standard Action", "Move Action", "Minor Action"]);
    expect(sections[0]?.powers.map((p) => p.id)).toEqual(["aw_std"]);
    expect(sections[1]?.powers.map((p) => p.id)).toEqual(["daily_move"]);
    expect(sections[2]?.powers.map((p) => p.id)).toEqual(["enc_minor"]);
  });

  it("merges action types that differ only by casing", () => {
    const mixedCase: GroupedPowerCards = {
      atWill: [
        power("std_lower", "Lower", "At-Will", "Standard action"),
        power("std_upper", "Upper", "At-Will", "Standard Action")
      ],
      encounter: [],
      daily: []
    };
    const sections = buildPowerDisplaySections(mixedCase, "actionType");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Standard Action");
    expect(sections[0]?.powers.map((p) => p.id).sort()).toEqual(["std_lower", "std_upper"]);
  });

  it("puts powers without action type in Other", () => {
    const withOther: GroupedPowerCards = {
      ...grouped,
      atWill: [power("no_action", "Mystery", "At-Will", "")]
    };
    const sections = buildPowerDisplaySections(withOther, "actionType");
    expect(sections.some((section) => section.title === "Other")).toBe(true);
    expect(getPowerActionType(withOther.atWill[0]!)).toBe("");
  });
});
