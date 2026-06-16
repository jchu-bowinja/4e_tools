import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrail for the data-driven builder refactor: runtime rule interpreters in
 * `src/rules` must stay generic. Behavior for any specific race/class/power/
 * theme/path/destiny is authored as data (compendium XML + `tools/etl/overrides`)
 * and consumed via normalized index fields — never by branching on a concrete
 * compendium entity id.
 *
 * A concrete id looks like `ID_FMP_CLASS_FEATURE_318` or `ID_FMP_CLASS_722`
 * (a namespace followed by a numeric suffix that identifies one entity). Generic
 * namespace prefixes such as `ID_FMP_POWER` or `startsWith("ID_FMP_CLASS_")`
 * carry no numeric suffix and remain allowed.
 */

const RULES_DIR = resolve(__dirname, "../../src/rules");

// Matches a fully-qualified compendium entity id literal (namespace + numeric suffix).
const CONCRETE_ENTITY_ID = /\bID_[A-Z][A-Z0-9_]*_\d+\b/;

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("src/rules contains no entity-specific id literals", () => {
  it("never hardcodes a concrete compendium entity id", () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(RULES_DIR)) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, i) => {
        const match = CONCRETE_ENTITY_ID.exec(line);
        if (match) {
          offenders.push(`${file}:${i + 1}: ${match[0]} — ${line.trim()}`);
        }
      });
    }
    expect(offenders, `Move entity-specific behavior into data (overlay/ETL):\n${offenders.join("\n")}`).toEqual([]);
  });
});
