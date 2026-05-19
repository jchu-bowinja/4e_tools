import { describe, expect, it } from "vitest";
import {
  applyFeatModificationsToPowerCardVm,
  collectFeatModificationsByPowerId,
  isFeatPowerAugmentation,
  isFeatPowerMetadataField,
  resolveAugmentationText
} from "../../src/rules/featPowerModifications";
import { buildCharacterPowerCardViewModel } from "../../src/ui/powerCard/characterPowerCardViewModel";
import type { Feat, Power, RulesIndex } from "../../src/rules/models";

describe("featPowerModifications", () => {
  it("classifies metadata vs augmentation fields", () => {
    expect(isFeatPowerMetadataField("Action Type")).toBe(true);
    expect(isFeatPowerMetadataField("Gulg Hunter Practice")).toBe(false);
    expect(isFeatPowerAugmentation({ powerName: "X", field: "Corellon's Wrath Style", value: "Bonus" })).toBe(true);
  });

  it("resolves augmentation text from value then feat body", () => {
    const feat = {
      id: "F1",
      name: "Gulg Hunter Practice",
      slug: "gulg",
      prereqTokens: [],
      raw: { body: "When you use a power associated with this feat…" },
      shortDescription: "Short"
    } as Feat;
    expect(resolveAugmentationText({ powerName: "Nimble Strike", field: "Gulg Hunter Practice", value: "" }, feat)).toBe(
      "When you use a power associated with this feat…"
    );
    expect(
      resolveAugmentationText(
        { powerName: "Twin Strike", field: "Corellon's Wrath Style", value: "Extra damage." },
        feat
      )
    ).toBe("Extra damage.");
  });

  it("collects modifications by power id from selected feats", () => {
    const index = {
      feats: [
        {
          id: "F_GULG",
          name: "Gulg Hunter Practice",
          slug: "gulg",
          prereqTokens: [],
          modifiedPowerIds: ["P_NIMBLE"],
          powerModifications: [
            { powerName: "nimble strike", powerId: "P_NIMBLE", field: "Gulg Hunter Practice", value: "" }
          ],
          raw: { body: "Concealment benefit." }
        }
      ],
      powers: [{ id: "P_NIMBLE", name: "Nimble Strike", slug: "nimble-strike", raw: { specific: {} } }]
    } as unknown as RulesIndex;

    const map = collectFeatModificationsByPowerId(index, ["F_GULG"]);
    const mods = map.get("P_NIMBLE");
    expect(mods?.augmentations).toHaveLength(1);
    expect(mods?.augmentations[0]?.featName).toBe("Gulg Hunter Practice");
    expect(mods?.augmentations[0]?.text).toBe("Concealment benefit.");
  });

  it("applies augmentations and metadata to power card view model", () => {
    const power: Power = {
      id: "P1",
      name: "Infernal Wrath",
      slug: "infernal-wrath",
      usage: "Encounter",
      raw: {
        specific: {
          "Power Usage": "Encounter",
          "Action Type": "Minor Action",
          Special: "Base special."
        }
      }
    };

    const base = buildCharacterPowerCardViewModel(power);
    const withMods = applyFeatModificationsToPowerCardVm(base, {
      augmentations: [{ featId: "F1", featName: "Ferocious Rebuke", text: "Push 1 square." }],
      metadata: [{ featId: "F2", featName: "Spirit Talker", field: "Action Type", value: "Standard Action" }]
    }, power.id);

    expect(withMods.augmentationLines).toHaveLength(1);
    expect(withMods.augmentationLines[0]?.text).toBe("Push 1 square.");
    const action = withMods.preAttackLines.find((l) => l.label === "Action");
    expect(action?.text).toContain("Standard Action");
  });

  it("buildCharacterPowerCardViewModel merges feat mods when provided", () => {
    const power: Power = {
      id: "P1",
      name: "Twin Strike",
      slug: "twin",
      usage: "At-Will",
      raw: { specific: { "Power Usage": "At-Will", Hit: "1[W]+Dex" } }
    };
    const vm = buildCharacterPowerCardViewModel(power, {
      augmentations: [{ featId: "F1", featName: "Corellon's Wrath Style", text: "Extra damage vs spider." }],
      metadata: []
    });
    expect(vm.augmentationLines).toHaveLength(1);
  });
});
