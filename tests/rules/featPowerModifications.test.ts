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

  it("resolves power id from compendium id in modification row", () => {
    const index = {
      feats: [
        {
          id: "F_INIT",
          name: "Initiate of the Faith",
          slug: "initiate",
          prereqTokens: [],
          modifiedPowerIds: ["ID_FMP_POWER_1455"],
          powerModifications: [
            {
              powerName: "ID_FMP_POWER_1455",
              powerId: "ID_FMP_POWER_1455",
              field: "Initiate of the Faith",
              value: "Extra healing."
            }
          ],
          raw: {}
        }
      ],
      powers: [{ id: "ID_FMP_POWER_1455", name: "Healing Word", slug: "healing-word", raw: { specific: {} } }]
    } as unknown as RulesIndex;

    const map = collectFeatModificationsByPowerId(index, ["F_INIT"]);
    expect(map.get("ID_FMP_POWER_1455")?.augmentations[0]?.text).toBe("Extra healing.");
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

  it("resolves Hand of Fury modify target to Hand of Radiance", () => {
    const index = {
      feats: [
        {
          id: "ID_FMP_FEAT_2990",
          name: "Hand of Fury",
          slug: "hand-of-fury",
          prereqTokens: [],
          powerModifications: [
            {
              powerName: "Hand of Fury",
              powerId: null,
              field: "Hand of Fury",
              value:
                "When you miss all targets with a daily invoker power, you can use hand of radiance as a minor action once before the end of your turn."
            }
          ],
          raw: {}
        }
      ],
      powers: [
        {
          id: "ID_FMP_POWER_7151",
          name: "Hand of Radiance",
          slug: "hand-of-radiance",
          raw: { specific: {} }
        }
      ]
    } as unknown as RulesIndex;

    const map = collectFeatModificationsByPowerId(index, ["ID_FMP_FEAT_2990"]);
    const mods = map.get("ID_FMP_POWER_7151");
    expect(mods?.augmentations).toHaveLength(1);
    expect(mods?.augmentations[0]?.featName).toBe("Hand of Fury");
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
