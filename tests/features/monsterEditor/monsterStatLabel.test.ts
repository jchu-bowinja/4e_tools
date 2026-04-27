import { describe, expect, it } from "vitest";
import {
  formatMonsterStatLabelForDisplay,
  monsterAbilityAbbrevFromStatKey,
  monsterStatGlossaryTermForKey,
  prettifyMonsterStatKey
} from "../../../src/features/monsterEditor/monsterTextUtils";

describe("formatMonsterStatLabelForDisplay / monsterStatGlossaryTermForKey", () => {
  it("abbreviates ability keys for display", () => {
    expect(formatMonsterStatLabelForDisplay("Strength")).toBe("STR");
    expect(formatMonsterStatLabelForDisplay("strength")).toBe("STR");
    expect(formatMonsterStatLabelForDisplay("dexterity")).toBe("DEX");
    expect(formatMonsterStatLabelForDisplay("STR")).toBe("STR");
    expect(formatMonsterStatLabelForDisplay("str")).toBe("STR");
  });

  it("keeps glossary hover terms as full PHB-style names for abilities", () => {
    expect(monsterStatGlossaryTermForKey("STR")).toBe("Strength");
    expect(monsterStatGlossaryTermForKey("dex")).toBe("Dexterity");
    expect(monsterStatGlossaryTermForKey("Constitution")).toBe("Constitution");
  });

  it("leaves non-ability stat keys readable", () => {
    expect(formatMonsterStatLabelForDisplay("abilityScores")).toBe("ability Scores");
    expect(monsterStatGlossaryTermForKey("abilityScores")).toBe("ability Scores");
    expect(formatMonsterStatLabelForDisplay("hitPoints")).toBe("hit Points");
  });

  it("prettifies camelCase consistently", () => {
    expect(prettifyMonsterStatKey("fooBar")).toBe("foo Bar");
  });

  it("maps labels to STR/DEX codes for tooltip fallback lookup", () => {
    expect(monsterAbilityAbbrevFromStatKey("Strength")).toBe("STR");
    expect(monsterAbilityAbbrevFromStatKey("dex")).toBe("DEX");
    expect(monsterAbilityAbbrevFromStatKey("abilityScores")).toBe(null);
  });
});
