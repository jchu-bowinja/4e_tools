import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { validateRulesIndexShape } from "../../src/data/loadRules";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";
import { CharacterBuilderApp } from "../../src/features/builder/CharacterBuilderApp";
import { CLASS_BUILD_OPTION_SELECTION_KEY } from "./builderChoiceVisibility";

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

const baseBuild = (): CharacterBuild => ({
  name: "Visibility test",
  level: 1,
  abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 10, CHA: 16 },
  featIds: [],
  powerIds: [],
  trainedSkillIds: []
});

describe("CharacterBuilderApp render", () => {
  it("renders to HTML with real rules index without throwing", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const html = renderToString(<CharacterBuilderApp index={index} tooltipGlossary={{}} />);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("Character");
  });

  it("renders Tome of Readiness encounter options on the Powers tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const wizard = index.classes.find((c) => c.slug === "wizard");
    expect(wizard).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: wizard!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_444": "ID_FMP_CLASS_FEATURE_1511"
      }
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="powers"
      />
    );

    expect(html).toContain("Channel Divinity &amp; class feature powers");
    expect(html).toContain("Burning Hands");
    expect(html).toContain("Select power…");
  });

  it("renders Infernal Pact Hellish Rebuke variant pick on the Powers tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const warlock = index.classes.find((c) => c.slug === "warlock");
    expect(warlock).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: warlock!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
      }
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="powers"
      />
    );

    expect(html).toContain("Infernal Pact");
    expect(html).toContain("Hellish Rebuke");
    expect(html).toContain("Gift to Avernus");
  });

  it("renders Elemental Specialty pick on the Class tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const elementalist = index.classes.find((c) => c.slug === "elementalist");
    expect(elementalist).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: elementalist!.id,
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_4335": "ID_FMP_CLASS_FEATURE_4336"
      }
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="class"
      />
    );

    expect(html).toContain("Elemental Specialty");
    expect(html).toContain("Howling Zephyr");
    expect(html).toContain("Static Charge");
  });

  it("renders Bloodsworn theme power on the Theme tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const bloodsworn = index.themes.find((t) => t.slug === "bloodsworn");
    expect(bloodsworn).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: index.classes.find((c) => c.slug === "wizard")!.id,
      themeId: bloodsworn!.id
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="theme"
      />
    );

    expect(html).toContain("Bloodied Determination");
  });

  it("renders Battle Cleric build pre-filled power slot picks on the Powers tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const cleric = index.classes.find((c) => c.slug === "cleric");
    expect(cleric).toBeDefined();

    const build: CharacterBuild = {
      ...baseBuild(),
      classId: cleric!.id,
      abilityScores: { STR: 10, CON: 10, DEX: 10, INT: 10, WIS: 16, CHA: 10 },
      classSelections: {
        [CLASS_BUILD_OPTION_SELECTION_KEY]: "ID_FMP_BUILD_6"
      }
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="powers"
      />
    );

    const battleCleric = index.classBuildOptionsByClassId?.[cleric!.id]?.find(
      (o) => o.id === "ID_FMP_BUILD_6"
    );
    expect(battleCleric?.powerIds?.length).toBeGreaterThan(0);
    const firstSuggested = index.powers.find((p) => p.id === battleCleric!.powerIds![0]);
    expect(firstSuggested).toBeDefined();
    expect(html).toContain(firstSuggested!.name);
  });

  it("renders Secrets of Belial non-class utility swap on the Powers tab", () => {
    stubBrowserGlobals();
    const raw = JSON.parse(readFileSync(RULES_PATH, "utf8")) as RulesIndex;
    const index = validateRulesIndexShape(raw);
    const warlock = index.classes.find((c) => c.slug === "warlock");
    const feat = index.feats.find((f) => f.id === "ID_FMP_FEAT_2311");
    expect(warlock).toBeDefined();
    expect(feat?.powerReplaceOffers?.[0]?.requireNonClassReplacement).toBe(true);

    const build: CharacterBuild = {
      ...baseBuild(),
      level: 11,
      classId: warlock!.id,
      featIds: ["ID_FMP_FEAT_2311"],
      classSelections: {
        "classFeature:ID_FMP_CLASS_FEATURE_777": "ID_FMP_CLASS_FEATURE_773"
      }
    };

    const html = renderToString(
      <CharacterBuilderApp
        index={index}
        tooltipGlossary={{}}
        initialBuild={build}
        initialActiveTab="powers"
      />
    );

    expect(html).toContain("Secrets of Belial");
    expect(html).toContain("swap for non-class utility");
    expect(html).toContain("Choose a class");
  });
});
