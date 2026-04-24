import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

describe("glossary_terms.json", () => {
  it("has unique, non-empty `name` values (case- and whitespace-insensitive)", () => {
    const raw = readFileSync(join(__dirname, "../../generated/glossary_terms.json"), "utf8");
    const rows = JSON.parse(raw) as Array<{ name?: string }>;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const name = row.name;
      if (typeof name !== "string" || !name.trim()) {
        expect.fail("Every glossary row should have a non-empty name");
      }
      const key = name.trim().toLowerCase().replace(/\s+/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([, c]) => c > 1);
    expect(dupes, { message: `Duplicate glossary names: ${JSON.stringify(dupes)}` }).toEqual([]);
  });
});
