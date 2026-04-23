import { describe, expect, it } from "vitest";
import { multiclassFeatIds } from "../../src/rules/multiclassDetection";

describe("multiclassDetection", () => {
  it("finds feats whose name or category references multiclass", () => {
    const index = {
      feats: [
        { id: "f1", name: "Toughness", category: "General" },
        { id: "f2", name: "Novice Power (multiclass)", category: "Class" },
        { id: "f3", name: "Something", category: "Multiclass" }
      ]
    } as never;
    const build = { featIds: ["f1", "f2", "f3"] } as never;
    expect(multiclassFeatIds(index, build)).toEqual(["f2", "f3"]);
  });
});
