import { describe, expect, it } from "vitest";
import { formatInternalGrantKey } from "../../src/rules/featGrantFlags";

describe("featGrantFlags", () => {
  it("formats internal grant keys for display", () => {
    expect(formatInternalGrantKey("KI_FOCUS_USER")).toBe("Ki Focus User");
    expect(formatInternalGrantKey("PSIONIC_SECOND_CLASS")).toBe("Psionic Second Class");
  });
});
