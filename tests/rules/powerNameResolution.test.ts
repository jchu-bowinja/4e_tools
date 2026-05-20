import { describe, expect, it } from "vitest";
import {
  buildPowerNameLookups,
  normalizePowerMatchKey,
  resolvePowerReference
} from "../../src/rules/powerNameResolution";

describe("powerNameResolution", () => {
  const lookups = buildPowerNameLookups([
    { id: "ID_WOLF", name: "Wolf Pack Tactics" },
    { id: "ID_CMD", name: "Commander's Strike" },
    { id: "ID_HEAL", name: "Healing Word" }
  ]);

  it("normalizes punctuation for fuzzy match", () => {
    expect(normalizePowerMatchKey("wolfpack tactics")).toBe(normalizePowerMatchKey("Wolf Pack Tactics"));
    expect(normalizePowerMatchKey("paint the bull's-eye")).toBe(normalizePowerMatchKey("Paint the Bulls-Eye"));
  });

  it("resolves compendium ids in modify rows", () => {
    expect(resolvePowerReference("ID_HEAL", lookups)).toBe("ID_HEAL");
  });

  it("resolves aliases and normalized names", () => {
    expect(resolvePowerReference("Command's Strike", lookups)).toBe("ID_CMD");
    expect(resolvePowerReference("wolfpack tactics", lookups)).toBe("ID_WOLF");
  });
});
