import { describe, expect, it } from "vitest";
import {
  collectFeatGrantedLanguageIds,
  formatInternalGrantKey,
} from "../../src/rules/featGrantFlags";
import type { CharacterBuild, RulesIndex } from "../../src/rules/models";

describe("featGrantFlags", () => {
  it("formats internal grant keys for display", () => {
    expect(formatInternalGrantKey("KI_FOCUS_USER")).toBe("Ki Focus User");
    expect(formatInternalGrantKey("PSIONIC_SECOND_CLASS")).toBe("Psionic Second Class");
  });

  it("collects language ids granted by feats", () => {
    const index = {
      feats: [
        {
          id: "ID_TEST_FEAT",
          name: "Envoy to the Fey",
          slug: "envoy-to-the-fey",
          prereqTokens: [],
          grantedLanguageIds: ["ID_FMP_LANGUAGE_4"],
          raw: {},
        },
      ],
    } as unknown as RulesIndex;
    const build = { featIds: ["ID_TEST_FEAT"] } as CharacterBuild;
    expect(collectFeatGrantedLanguageIds(index, build)).toEqual(["ID_FMP_LANGUAGE_4"]);
  });
});
