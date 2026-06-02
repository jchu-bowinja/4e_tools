import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getConsumablesFromIndex } from "../../src/data/loadConsumablesCatalog";
import { validateRulesIndexShape } from "../../src/data/loadRules";

const INDEX_PATH = resolve(process.cwd(), "generated/rules_index.json");
const ADVENTURING_GEAR_CATALOG = resolve(
  process.cwd(),
  "generated/catalogs/adventuring_gear.json"
);

describe("consumables catalog files", () => {
  it.skipIf(!existsSync(INDEX_PATH))("rules_index includes consumables arrays after ETL", () => {
    const data = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
    const index = validateRulesIndexShape(data);
    const catalog = getConsumablesFromIndex(index);
    expect(catalog.adventuringGear.length).toBeGreaterThan(0);
    expect(catalog.rituals.length).toBeGreaterThan(0);
    expect(catalog.martialPractices.length).toBeGreaterThan(0);
    expect(catalog.alchemyItems.length).toBeGreaterThan(0);
  });

  it.skipIf(!existsSync(ADVENTURING_GEAR_CATALOG))("writes adventuring gear catalog slice", () => {
    const rows = JSON.parse(readFileSync(ADVENTURING_GEAR_CATALOG, "utf-8")) as Array<{ category?: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.category === "Gear" || r.category === "Ammunition")).toBe(true);
  });
});
