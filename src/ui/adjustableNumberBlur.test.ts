import { describe, expect, it } from "vitest";
import { parseAdjustableNumberBlur } from "./adjustableNumberBlur";

describe("parseAdjustableNumberBlur", () => {
  it("commits in-range integers", () => {
    expect(parseAdjustableNumberBlur("15", { min: 0, max: 30, optional: false })).toEqual({
      kind: "commit",
      value: 15
    });
  });

  it("reverts out-of-range values", () => {
    expect(parseAdjustableNumberBlur("51", { min: 0, max: 30, optional: false })).toEqual({ kind: "revert" });
  });

  it("reverts non-numeric text", () => {
    expect(parseAdjustableNumberBlur("abc", { min: 0, max: 9, optional: false })).toEqual({ kind: "revert" });
  });

  it("reverts empty required fields", () => {
    expect(parseAdjustableNumberBlur("", { min: 0, max: 9, optional: false })).toEqual({ kind: "revert" });
    expect(parseAdjustableNumberBlur("   ", { min: 0, max: 9, optional: false })).toEqual({ kind: "revert" });
  });

  it("commits empty optional fields as undefined", () => {
    expect(parseAdjustableNumberBlur("", { min: 0, max: 9, optional: true })).toEqual({
      kind: "commit",
      value: undefined
    });
  });
});
