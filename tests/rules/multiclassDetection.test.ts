import { describe, expect, it } from "vitest";
import {
  collectCountsAsClassNames,
  collectInternalGrantKeys,
  collectMulticlassFeatIds
} from "../../src/rules/featGrantFlags";
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

  it("detects Multiclass grant from ETL without name heuristics", () => {
    const index = {
      feats: [
        { id: "f1", name: "Sneak of Shadows", hasMulticlassGrant: true },
        { id: "f2", name: "Toughness" }
      ]
    } as never;
    const build = { featIds: ["f1", "f2"] } as never;
    expect(collectMulticlassFeatIds(index, build)).toEqual(["f1"]);
  });

  it("aggregates CountsAsClass and Internal grants from selected feats", () => {
    const index = {
      feats: [
        {
          id: "f1",
          name: "Sneak of Shadows",
          countsAsClassNames: ["Rogue"],
          internalGrantKeys: ["BLOODLINE"]
        }
      ]
    } as never;
    const build = { featIds: ["f1"] } as never;
    expect(collectCountsAsClassNames(index, build)).toEqual(["Rogue"]);
    expect(collectInternalGrantKeys(index, build)).toEqual(["BLOODLINE"]);
  });
});
