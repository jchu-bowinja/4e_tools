import { describe, expect, it } from "vitest";
import { alchemyDescriptionParts, hasConsumableDescription } from "../../src/rules/consumablesDisplay";
import type { MagicItem } from "../../src/rules/models";

describe("consumablesDisplay", () => {
  it("uses power text as alchemy body when compendium body is absent", () => {
    const item = {
      id: "test",
      name: "Test Potion",
      slug: "test",
      flavor: "Tasty.",
      power: "Drink to heal.",
      raw: {}
    } as MagicItem;
    expect(alchemyDescriptionParts(item)).toEqual({ flavor: "Tasty.", body: "Drink to heal." });
    expect(hasConsumableDescription(alchemyDescriptionParts(item))).toBe(true);
  });

  it("joins array power entries from the rules index", () => {
    const item = {
      id: "test",
      name: "Test",
      slug: "test",
      power: ["Line one.", "Line two."],
      raw: {}
    } as MagicItem;
    expect(alchemyDescriptionParts(item)).toEqual({ body: "Line one.\nLine two." });
  });
});
