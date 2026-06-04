import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { validateRulesIndexShape } from "../../src/data/loadRules";
import type { RulesIndex } from "../../src/rules/models";
import { CharacterBuilderApp } from "../../src/features/builder/CharacterBuilderApp";

const RULES_PATH = join(process.cwd(), "generated", "rules_index.json");

function stubBrowserGlobals(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  });
  vi.stubGlobal("window", {
    innerWidth: 1920,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  });
}

describe("CharacterBuilderApp render", () => {
  it("renders to HTML with real rules index without throwing", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const html = renderToString(<CharacterBuilderApp index={index} tooltipGlossary={{}} />);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("Character");
  });
});
