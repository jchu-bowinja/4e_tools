import { describe, expect, it } from "vitest";

describe("builder module graph", () => {
  it(
    "loads CharacterBuilderApp without circular import failure",
    async () => {
      const mod = await import("../../src/features/builder/CharacterBuilderApp");
      expect(typeof mod.CharacterBuilderApp).toBe("function");
    },
    30_000
  );

  it(
    "loads ConsumableItemDescription from ui without pulling unfinished builder exports",
    async () => {
      const mod = await import("../../src/ui/ConsumableItemDescription");
      expect(typeof mod.ConsumableItemDescription).toBe("function");
    },
    30_000
  );
});
