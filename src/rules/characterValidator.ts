import {
  expectedClassAtWillAttackSlots,
  expectedClassDailyAttackSlots,
  expectedClassEncounterAttackSlots,
  expectedClassUtilityPowerCount,
  isHumanRace,
  requiredAsiMilestonesUpTo,
  totalFeatSlots
} from "./advancement";
import { CharacterBuild, ClassDef, HybridClassDef, Power, RulesIndex, Skill } from "./models";
import { buildClassPowerSlotDefinitions, powerPrintedLevelEligibleForSlot } from "./classPowerSlots";
import { getClassPowersForLevelRange, getDilettanteCandidatePowers } from "./classPowersQuery";
import { evaluatePrereqs, hybridBaseClassNames } from "./prereqEvaluator";
import {
  bonusClassAtWillSlotFromRaceBuild,
  racePowerGroupsForRace,
  racePowerSelectSelectionKey
} from "./grantedPowersQuery";
import { isProficientWithImplement, isProficientWithWeapon } from "./weaponAttack";
import { mergeHybridProficiencyLines, parseHybridDefenseBonuses } from "./hybridDerivedStats";
import { collectCharacterPowerIdsForSelections } from "./powerSelections";
import { hybridCombinedClassSkillNames, expectedHybridTrainedSkillCount } from "./hybridSkills";
import {
  buildHybridPowerSlotDefinitions,
  hybridPowerPoolUnion,
  powerAllowedForHybridSlot
} from "./hybridPowerSlots";
import { getChildTraitIdsForSubrace, getRaceSubraceData } from "./raceSubraces";
import { getRaceSecondarySelectSlots, selectableStartingLanguages } from "./raceRuleSelects";

export { getClassPowersForLevelRange };

export interface ClassSkillRules {
  classSkillNames: string[];
  requiredTrainedSkillNames: string[];
  chooseAdditionalCount: number;
}

export interface PowerSlotRules {
  atWill: number;
  encounter: number;
  daily: number;
  /** Expected class utility powers for current level (PHB-style schedule). */
  utility: number;
}

export interface CharacterLegality {
  errors: string[];
  warnings: string[];
  classSkillRules?: ClassSkillRules;
  powerSlotRules?: PowerSlotRules;
  classDefenseBonuses?: Partial<Record<"Fortitude" | "Reflex" | "Will", number>>;
}

function splitSkillNames(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .map((s) => s.replace(/\([^)]+\)/g, "").trim())
    .filter(Boolean);
}

export function parseClassSkillRules(cls: ClassDef): ClassSkillRules {
  const spec = ((cls.raw.specific as Record<string, unknown>) || {}) as Record<string, string | null>;
  const classSkillsText = spec["Class Skills"] || "";
  const trainedSkillsText = spec["Trained Skills"] || "";

  const classSkillNames = splitSkillNames(classSkillsText);

  const chooseMatch = trainedSkillsText.match(/choose\s+(\d+)\s+(more\s+)?trained skills?/i);
  const chooseAdditionalCount = chooseMatch ? Number(chooseMatch[1]) : 0;

  const requiredTrainedSkillNames: string[] = [];
  if (trainedSkillsText.includes(".")) {
    const firstClause = trainedSkillsText.split(".")[0]?.trim() || "";
    const maybeSkills = firstClause
      .split(/,| and /i)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const skill of maybeSkills) {
      if (/^[A-Za-z ]+$/.test(skill) && !/from the class skills/i.test(skill)) {
        requiredTrainedSkillNames.push(skill);
      }
    }
  }

  return {
    classSkillNames,
    requiredTrainedSkillNames,
    chooseAdditionalCount
  };
}

export function getLevel1ClassPowerSlotRules(): PowerSlotRules {
  return { atWill: 2, encounter: 1, daily: 1, utility: 0 };
}

/** Match builder UI: only at-will / encounter / daily buckets (nonstandard usage → encounter). */
function normalizeUsage(usage: string | null | undefined): "At-Will" | "Encounter" | "Daily" {
  if (!usage) return "Encounter";
  const u = usage.toLowerCase();
  if (u.includes("at-will")) return "At-Will";
  if (u.includes("encounter")) return "Encounter";
  if (u.includes("daily")) return "Daily";
  return "Encounter";
}

export function getLevel1ClassPowers(index: RulesIndex, build: CharacterBuild): Power[] {
  return getClassPowersForLevelRange(index, build.classId, 1, "attack");
}

export function validateCharacterBuild(index: RulesIndex, build: CharacterBuild): CharacterLegality {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isHybrid = build.characterStyle === "hybrid";
  const hybridA: HybridClassDef | undefined = isHybrid
    ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdA)
    : undefined;
  const hybridB: HybridClassDef | undefined = isHybrid
    ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdB)
    : undefined;
  const classIdForDilettante = isHybrid ? hybridA?.baseClassId : build.classId;

  if (!build.raceId) {
    errors.push("Choose a race.");
  }
  if (!isHybrid && !build.classId) {
    errors.push("Choose a class.");
  }
  if (isHybrid) {
    if (!build.hybridClassIdA || !build.hybridClassIdB) {
      errors.push("Choose two hybrid classes.");
    } else if (build.hybridClassIdA === build.hybridClassIdB) {
      errors.push("Hybrid classes must be two different entries.");
    }
  }

  if (build.raceId) {
    const race = index.races.find((r) => r.id === build.raceId);
    if (race) {
      const slots = getRaceSecondarySelectSlots(race);
      const rs = build.raceSelections || {};
      const langs = index.languages ?? [];
      const legalLangIds = new Set(selectableStartingLanguages(langs).map((l) => l.id));
      const legalSkillIds = new Set(index.skills.map((s) => s.id));
      for (const slot of slots) {
        const picked = rs[slot.key];
        if (!picked) {
          errors.push(`Race: ${slot.label} — make a selection.`);
          continue;
        }
        if (slot.kind === "language" && !legalLangIds.has(picked)) {
          errors.push(`Race: ${slot.label} — pick a valid language.`);
        }
        if (slot.kind === "skillBonus" && !legalSkillIds.has(picked)) {
          errors.push(`Race: ${slot.label} — pick a valid skill.`);
        }
      }

      const racialTraitById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
      const raceSubraceData = getRaceSubraceData(race, racialTraitById);
      const subPick = rs["subrace"];
      const selectedSubrace =
        subPick && raceSubraceData ? raceSubraceData.options.find((o) => o.id === subPick) : undefined;
      const extraTraitIds: string[] = [];
      if (selectedSubrace) {
        extraTraitIds.push(selectedSubrace.id);
        extraTraitIds.push(...getChildTraitIdsForSubrace(selectedSubrace));
      }
      for (const g of racePowerGroupsForRace(race, racialTraitById, extraTraitIds)) {
        if (!g.choiceOnly) continue;
        const pk = racePowerSelectSelectionKey(g.traitId);
        const pickedPower = rs[pk];

        if (g.dilettantePick) {
          if (!classIdForDilettante) {
            errors.push(
              `Race: ${g.traitName} — choose a class on the Class tab to pick a Dilettante power from another class's at-will list.`
            );
            continue;
          }
          const legal = getDilettanteCandidatePowers(
            index,
            classIdForDilettante,
            isHybrid ? hybridB?.baseClassId ?? undefined : undefined
          );
          const legalIds = new Set(legal.map((p) => p.id));
          if (!pickedPower) {
            errors.push(
              `Race: ${g.traitName} — choose a 1st-level at-will attack power from a class other than yours (Dilettante).`
            );
            continue;
          }
          if (!legalIds.has(pickedPower)) {
            errors.push(`Race: ${g.traitName} — selected power is not a legal Dilettante choice for your class.`);
          }
          continue;
        }

        if (g.powerIds.length === 0) continue;
        if (!pickedPower) {
          errors.push(`Race: ${g.traitName} — choose a racial power from this trait.`);
          continue;
        }
        if (!g.powerIds.includes(pickedPower)) {
          errors.push(`Race: ${g.traitName} — selected power is not a legal option for this trait.`);
        }
      }
    }
  }

  const cls = !isHybrid ? index.classes.find((c) => c.id === build.classId) : undefined;
  const baseClassA = hybridA?.baseClassId ? index.classes.find((c) => c.id === hybridA.baseClassId) : undefined;
  const baseClassB = hybridB?.baseClassId ? index.classes.find((c) => c.id === hybridB.baseClassId) : undefined;

  if (isHybrid && build.hybridClassIdA && !hybridA) {
    errors.push("First hybrid class is not in the rules index.");
  }
  if (isHybrid && build.hybridClassIdB && !hybridB) {
    errors.push("Second hybrid class is not in the rules index.");
  }
  if (isHybrid && hybridA && hybridB && (!hybridA.baseClassId || !hybridB.baseClassId)) {
    errors.push("Hybrid class data is missing base class links.");
  }
  if (isHybrid && hybridA && hybridB && hybridA.baseClassId && hybridB.baseClassId && (!baseClassA || !baseClassB)) {
    errors.push("One or both hybrid base classes are missing from the rules index.");
  }

  const skillsById = new Map<string, Skill>(index.skills.map((s) => [s.id, s]));
  const trainedSkillNames = build.trainedSkillIds
    .map((id) => skillsById.get(id)?.name)
    .filter((s): s is string => Boolean(s));

  let classSkillRules: ClassSkillRules | undefined;
  let powerSlotRules: PowerSlotRules | undefined;
  let classDefenseBonuses: Partial<Record<"Fortitude" | "Reflex" | "Will", number>> | undefined;

  if (!isHybrid && cls) {
    const specific = (cls.raw.specific as Record<string, unknown> | undefined) || {};
    const armorProficiencies = String(specific["Armor Proficiencies"] || "").toLowerCase();
    const bonusToDefenseText = String(specific["Bonus to Defense"] || "");
    classDefenseBonuses = {};
    const defenseMatches = bonusToDefenseText.matchAll(/([+-]\d+)\s*(Fortitude|Reflex|Will)/gi);
    for (const match of defenseMatches) {
      const value = Number(match[1]);
      const key = match[2] as "Fortitude" | "Reflex" | "Will";
      classDefenseBonuses[key] = (classDefenseBonuses[key] || 0) + value;
    }

    classSkillRules = parseClassSkillRules(cls);

    const raceName = index.races.find((r) => r.id === build.raceId)?.name;
    const human = isHumanRace(raceName);
    const bonusThirdClassAtWill = bonusClassAtWillSlotFromRaceBuild(index, build);
    const wantAw = expectedClassAtWillAttackSlots(build.level, bonusThirdClassAtWill);
    const wantEnc = expectedClassEncounterAttackSlots(build.level);
    const wantDaily = expectedClassDailyAttackSlots(build.level);
    const wantUtil = expectedClassUtilityPowerCount(build.level);
    powerSlotRules = { atWill: wantAw, encounter: wantEnc, daily: wantDaily, utility: wantUtil };

    const expectedFeats = totalFeatSlots(build.level, human);
    const uniqueFeat = new Set(build.featIds);
    if (uniqueFeat.size !== build.featIds.length) {
      errors.push("Duplicate feats are not allowed; pick each feat only once.");
    }
    if (build.featIds.length !== expectedFeats) {
      errors.push(
        `Select exactly ${expectedFeats} feat${expectedFeats === 1 ? "" : "s"} for level ${build.level} (currently ${build.featIds.length}).`
      );
    }

    const asiMilestones = requiredAsiMilestonesUpTo(build.level);
    for (const m of asiMilestones) {
      const pick = build.asiChoices?.[String(m)];
      if (!pick?.first || !pick?.second) {
        errors.push(`Ability increases: choose two different abilities at level ${m}.`);
      } else if (pick.first === pick.second) {
        errors.push(`Ability increases at level ${m}: the two +1 choices must be different abilities.`);
      }
    }

    const requiredLower = new Set(
      classSkillRules.requiredTrainedSkillNames.map((s) => s.toLowerCase())
    );
    const classSkillLower = new Set(classSkillRules.classSkillNames.map((s) => s.toLowerCase()));
    const trainedLower = trainedSkillNames.map((s) => s.toLowerCase());

    for (const required of requiredLower) {
      if (!trainedLower.includes(required)) {
        errors.push(`Class requires training in ${required}.`);
      }
    }

    const optionalSelected = trainedLower.filter((s) => classSkillLower.has(s) && !requiredLower.has(s)).length;
    const expectedOptional = classSkillRules.chooseAdditionalCount;
    if (optionalSelected !== expectedOptional) {
      errors.push(`Select ${expectedOptional} additional class skills (currently ${optionalSelected}).`);
    }

    const offList = trainedLower.filter((s) => !classSkillLower.has(s) && !requiredLower.has(s));
    if (offList.length > 0) {
      errors.push(`Trained skills must come from class skills list: ${offList.join(", ")}.`);
    }

    const selectedArmor = index.armors.find((a) => a.id === build.armorId);
    const selectedShield = index.armors.find((a) => a.id === build.shieldId);
    const featNames = new Set(
      build.featIds
        .map((id) => index.feats.find((f) => f.id === id)?.name?.toLowerCase() || "")
        .filter(Boolean)
    );

    function hasArmorProficiency(label: string): boolean {
      const lower = label.toLowerCase();
      if (armorProficiencies.includes(lower)) return true;
      return featNames.has(`armor proficiency: ${label.toLowerCase()}`);
    }

    if (selectedArmor) {
      const category = String(selectedArmor.armorCategory || "").toLowerCase();
      if (category.includes("cloth") && !hasArmorProficiency("cloth")) {
        errors.push("Missing Cloth armor proficiency for selected armor.");
      }
      if (category.includes("leather") && !hasArmorProficiency("leather")) {
        errors.push("Missing Leather armor proficiency for selected armor.");
      }
      if (category.includes("hide") && !hasArmorProficiency("hide")) {
        errors.push("Missing Hide armor proficiency for selected armor.");
      }
      if (category.includes("chain") && !hasArmorProficiency("chainmail")) {
        errors.push("Missing Chainmail armor proficiency for selected armor.");
      }
      if (category.includes("scale") && !hasArmorProficiency("scale")) {
        errors.push("Missing Scale armor proficiency for selected armor.");
      }
      if (category.includes("plate") && !hasArmorProficiency("plate")) {
        errors.push("Missing Plate armor proficiency for selected armor.");
      }
    }

    if (selectedShield) {
      const shieldCat = String(selectedShield.armorCategory || "").toLowerCase();
      if (shieldCat.includes("light") && !armorProficiencies.includes("light shields")) {
        errors.push("Missing Light Shield proficiency for selected shield.");
      }
      if (shieldCat.includes("heavy") && !armorProficiencies.includes("heavy shields")) {
        errors.push("Missing Heavy Shield proficiency for selected shield.");
      }
    }

    const weaponsIndex = index.weapons ?? [];
    const implementsIndex = index.implements ?? [];
    const weaponProfText = String(specific["Weapon Proficiencies"] || "");
    const implementSupportText = [specific["Implements"], specific["Implement"]].filter((x) => typeof x === "string").join("; ");

    if (build.mainWeaponId) {
      const mw = weaponsIndex.find((w) => w.id === build.mainWeaponId);
      if (!mw) {
        errors.push("Selected main weapon is not in the rules index.");
      } else if (!isProficientWithWeapon(mw, weaponProfText)) {
        warnings.push(
          `Main weapon "${mw.name}" — your class weapon proficiencies may not include this category (nonproficient weapon attacks take −2).`
        );
      }
    }
    if (build.offHandWeaponId) {
      const ow = weaponsIndex.find((w) => w.id === build.offHandWeaponId);
      if (!ow) {
        errors.push("Selected off-hand weapon is not in the rules index.");
      } else if (!isProficientWithWeapon(ow, weaponProfText)) {
        warnings.push(
          `Off-hand weapon "${ow.name}" — your class weapon proficiencies may not include this category (nonproficient weapon attacks take −2).`
        );
      }
    }
    if (build.implementId) {
      const imp = implementsIndex.find((x) => x.id === build.implementId);
      if (!imp) {
        errors.push("Selected implement is not in the rules index.");
      } else if (!isProficientWithImplement(imp, implementSupportText)) {
        warnings.push(
          `Implement "${imp.name}" — your class may not match this implement group (nonproficient implement attacks take −2).`
        );
      }
    }

    const attackPowers = getClassPowersForLevelRange(index, build.classId, build.level, "attack");
    const utilityPowers = getClassPowersForLevelRange(index, build.classId, build.level, "utility");
    const allowedPowerIds = new Set([...attackPowers, ...utilityPowers].map((p) => p.id));
    const stray = build.powerIds.filter((id) => !allowedPowerIds.has(id));
    if (stray.length > 0) {
      errors.push("Each selected power must be a class attack or utility power of your level or lower.");
    }

    const classPowerIdsOrdered = build.powerIds.filter((id) => allowedPowerIds.has(id));
    if (new Set(classPowerIdsOrdered).size !== classPowerIdsOrdered.length) {
      errors.push("Choose each class power at most once (duplicate selections).");
    }

    const slots = build.classPowerSlots;
    if (slots) {
      const slotDefs = buildClassPowerSlotDefinitions(build.level, bonusThirdClassAtWill);
      const defByKey = new Map(slotDefs.map((d) => [d.key, d]));
      for (const [key, rawId] of Object.entries(slots)) {
        const id = String(rawId || "").trim();
        if (!id) continue;
        const def = defByKey.get(key);
        const p = index.powers.find((x) => x.id === id);
        if (!def || !p) continue;
        if (!powerPrintedLevelEligibleForSlot(p, def)) {
          errors.push(
            `Power "${p.name}" is above the printed level allowed for "${def.label}" (level ${def.gainLevel} or lower only).`
          );
        }
      }
    }

    const selectedAttack = attackPowers.filter((p) => build.powerIds.includes(p.id));
    const selectedUtility = utilityPowers.filter((p) => build.powerIds.includes(p.id));
    const counts = { atWill: 0, encounter: 0, daily: 0 };
    for (const p of selectedAttack) {
      const usage = normalizeUsage(p.usage);
      if (usage === "At-Will") counts.atWill += 1;
      if (usage === "Encounter") counts.encounter += 1;
      if (usage === "Daily") counts.daily += 1;
    }

    if (counts.atWill !== powerSlotRules.atWill) {
      errors.push(
        `Select exactly ${powerSlotRules.atWill} class at-will attack power${powerSlotRules.atWill === 1 ? "" : "s"} for your level (currently ${counts.atWill}).`
      );
    }
    if (counts.encounter !== powerSlotRules.encounter) {
      errors.push(
        `Select exactly ${powerSlotRules.encounter} class encounter attack power${powerSlotRules.encounter === 1 ? "" : "s"} for your level (currently ${counts.encounter}).`
      );
    }
    if (counts.daily !== powerSlotRules.daily) {
      errors.push(
        `Select exactly ${powerSlotRules.daily} class daily attack power${powerSlotRules.daily === 1 ? "" : "s"} for your level (currently ${counts.daily}).`
      );
    }
    if (selectedUtility.length !== powerSlotRules.utility) {
      errors.push(
        `Select exactly ${powerSlotRules.utility} class utility power${powerSlotRules.utility === 1 ? "" : "s"} for your level (currently ${selectedUtility.length}).`
      );
    }
  } else if (isHybrid && hybridA && hybridB && baseClassA && baseClassB) {
    classDefenseBonuses = parseHybridDefenseBonuses(hybridA, hybridB);

    const talentOptsA = hybridA.hybridTalentClassFeatures ?? [];
    if (talentOptsA.length > 0) {
      const tid = build.hybridTalentClassFeatureIdA;
      if (!tid || !talentOptsA.some((o) => o.id === tid)) {
        errors.push("Select a hybrid talent for your first hybrid class.");
      }
    }
    const talentOptsB = hybridB.hybridTalentClassFeatures ?? [];
    if (talentOptsB.length > 0) {
      const tid = build.hybridTalentClassFeatureIdB;
      if (!tid || !talentOptsB.some((o) => o.id === tid)) {
        errors.push("Select a hybrid talent for your second hybrid class.");
      }
    }

    for (const g of hybridA.hybridSelectionGroups ?? []) {
      const picked = build.hybridSideASelections?.[g.key];
      const legal = new Set(g.options.map((o) => o.id));
      if (!picked || !legal.has(picked)) {
        errors.push(`Select ${g.label} (first hybrid class).`);
      }
    }
    for (const g of hybridB.hybridSelectionGroups ?? []) {
      const picked = build.hybridSideBSelections?.[g.key];
      const legal = new Set(g.options.map((o) => o.id));
      if (!picked || !legal.has(picked)) {
        errors.push(`Select ${g.label} (second hybrid class).`);
      }
    }

    const intScore = build.abilityScores.INT || 10;
    const expectedTrainHybrid = expectedHybridTrainedSkillCount(intScore);
    const unionSkillNames = hybridCombinedClassSkillNames(hybridA, hybridB);
    classSkillRules = {
      classSkillNames: unionSkillNames,
      requiredTrainedSkillNames: [],
      chooseAdditionalCount: expectedTrainHybrid
    };

    const raceName = index.races.find((r) => r.id === build.raceId)?.name;
    const human = isHumanRace(raceName);
    const bonusThirdClassAtWill = bonusClassAtWillSlotFromRaceBuild(index, build);
    const wantAw = expectedClassAtWillAttackSlots(build.level, bonusThirdClassAtWill);
    const wantEnc = expectedClassEncounterAttackSlots(build.level);
    const wantDaily = expectedClassDailyAttackSlots(build.level);
    const wantUtil = expectedClassUtilityPowerCount(build.level);
    powerSlotRules = { atWill: wantAw, encounter: wantEnc, daily: wantDaily, utility: wantUtil };

    const expectedFeats = totalFeatSlots(build.level, human);
    const uniqueFeat = new Set(build.featIds);
    if (uniqueFeat.size !== build.featIds.length) {
      errors.push("Duplicate feats are not allowed; pick each feat only once.");
    }
    if (build.featIds.length !== expectedFeats) {
      errors.push(
        `Select exactly ${expectedFeats} feat${expectedFeats === 1 ? "" : "s"} for level ${build.level} (currently ${build.featIds.length}).`
      );
    }

    const asiMilestones = requiredAsiMilestonesUpTo(build.level);
    for (const m of asiMilestones) {
      const pick = build.asiChoices?.[String(m)];
      if (!pick?.first || !pick?.second) {
        errors.push(`Ability increases: choose two different abilities at level ${m}.`);
      } else if (pick.first === pick.second) {
        errors.push(`Ability increases at level ${m}: the two +1 choices must be different abilities.`);
      }
    }

    const requiredLowerHy = new Set(classSkillRules.requiredTrainedSkillNames.map((s) => s.toLowerCase()));
    const classSkillLowerHy = new Set(classSkillRules.classSkillNames.map((s) => s.toLowerCase()));
    const trainedLowerHy = trainedSkillNames.map((s) => s.toLowerCase());

    for (const required of requiredLowerHy) {
      if (!trainedLowerHy.includes(required)) {
        errors.push(`Class requires training in ${required}.`);
      }
    }

    const optionalSelectedHy = trainedLowerHy.filter((s) => classSkillLowerHy.has(s) && !requiredLowerHy.has(s)).length;
    if (optionalSelectedHy !== classSkillRules.chooseAdditionalCount) {
      errors.push(
        `Select exactly ${classSkillRules.chooseAdditionalCount} trained skills from your hybrid class skill lists (currently ${optionalSelectedHy}).`
      );
    }

    const offListHy = trainedLowerHy.filter((s) => !classSkillLowerHy.has(s) && !requiredLowerHy.has(s));
    if (offListHy.length > 0) {
      errors.push(`Trained skills must come from hybrid class skills list: ${offListHy.join(", ")}.`);
    }

    const mergedProf = mergeHybridProficiencyLines(hybridA, hybridB);
    const armorProficienciesHy = mergedProf.armorLine.toLowerCase();
    const featNamesHy = new Set(
      build.featIds.map((id) => index.feats.find((f) => f.id === id)?.name?.toLowerCase() || "").filter(Boolean)
    );

    function hasArmorProficiencyHy(label: string): boolean {
      const lower = label.toLowerCase();
      if (armorProficienciesHy.includes(lower)) return true;
      return featNamesHy.has(`armor proficiency: ${label.toLowerCase()}`);
    }

    const selectedArmorHy = index.armors.find((a) => a.id === build.armorId);
    const selectedShieldHy = index.armors.find((a) => a.id === build.shieldId);

    if (selectedArmorHy) {
      const category = String(selectedArmorHy.armorCategory || "").toLowerCase();
      if (category.includes("cloth") && !hasArmorProficiencyHy("cloth")) {
        errors.push("Missing Cloth armor proficiency for selected armor.");
      }
      if (category.includes("leather") && !hasArmorProficiencyHy("leather")) {
        errors.push("Missing Leather armor proficiency for selected armor.");
      }
      if (category.includes("hide") && !hasArmorProficiencyHy("hide")) {
        errors.push("Missing Hide armor proficiency for selected armor.");
      }
      if (category.includes("chain") && !hasArmorProficiencyHy("chainmail")) {
        errors.push("Missing Chainmail armor proficiency for selected armor.");
      }
      if (category.includes("scale") && !hasArmorProficiencyHy("scale")) {
        errors.push("Missing Scale armor proficiency for selected armor.");
      }
      if (category.includes("plate") && !hasArmorProficiencyHy("plate")) {
        errors.push("Missing Plate armor proficiency for selected armor.");
      }
    }

    if (selectedShieldHy) {
      const shieldCat = String(selectedShieldHy.armorCategory || "").toLowerCase();
      if (shieldCat.includes("light") && !armorProficienciesHy.includes("light shields")) {
        errors.push("Missing Light Shield proficiency for selected shield.");
      }
      if (shieldCat.includes("heavy") && !armorProficienciesHy.includes("heavy shields")) {
        errors.push("Missing Heavy Shield proficiency for selected shield.");
      }
    }

    const weaponsIndex = index.weapons ?? [];
    const implementsIndex = index.implements ?? [];
    const weaponProfTextHy = mergedProf.weaponLine;
    const implementSupportTextHy = mergedProf.implementLine;

    if (build.mainWeaponId) {
      const mw = weaponsIndex.find((w) => w.id === build.mainWeaponId);
      if (!mw) {
        errors.push("Selected main weapon is not in the rules index.");
      } else if (!isProficientWithWeapon(mw, weaponProfTextHy)) {
        warnings.push(
          `Main weapon "${mw.name}" — your hybrid weapon proficiencies may not include this category (nonproficient weapon attacks take −2).`
        );
      }
    }
    if (build.offHandWeaponId) {
      const ow = weaponsIndex.find((w) => w.id === build.offHandWeaponId);
      if (!ow) {
        errors.push("Selected off-hand weapon is not in the rules index.");
      } else if (!isProficientWithWeapon(ow, weaponProfTextHy)) {
        warnings.push(
          `Off-hand weapon "${ow.name}" — your hybrid weapon proficiencies may not include this category (nonproficient weapon attacks take −2).`
        );
      }
    }
    if (build.implementId) {
      const imp = implementsIndex.find((x) => x.id === build.implementId);
      if (!imp) {
        errors.push("Selected implement is not in the rules index.");
      } else if (!isProficientWithImplement(imp, implementSupportTextHy)) {
        warnings.push(
          `Implement "${imp.name}" — your hybrid classes may not match this implement group (nonproficient implement attacks take −2).`
        );
      }
    }

    const baseAid = hybridA.baseClassId!;
    const baseBid = hybridB.baseClassId!;
    const attackPowersHy = hybridPowerPoolUnion(index, baseAid, baseBid, build.level, "attack");
    const utilityPowersHy = hybridPowerPoolUnion(index, baseAid, baseBid, build.level, "utility");
    const allowedPowerIdsHy = new Set([...attackPowersHy, ...utilityPowersHy].map((p) => p.id));
    const strayHy = build.powerIds.filter((id) => !allowedPowerIdsHy.has(id));
    if (strayHy.length > 0) {
      errors.push("Each selected power must come from one of your hybrid base classes, at your level or lower.");
    }

    const classPowerIdsOrderedHy = build.powerIds.filter((id) => allowedPowerIdsHy.has(id));
    if (new Set(classPowerIdsOrderedHy).size !== classPowerIdsOrderedHy.length) {
      errors.push("Choose each class power at most once (duplicate selections).");
    }

    const slotsHy = build.classPowerSlots;
    if (slotsHy) {
      const slotDefsHy = buildHybridPowerSlotDefinitions(build.level, bonusThirdClassAtWill);
      const defByKeyHy = new Map(slotDefsHy.map((d) => [d.key, d]));
      for (const [key, rawId] of Object.entries(slotsHy)) {
        const id = String(rawId || "").trim();
        if (!id) continue;
        const def = defByKeyHy.get(key);
        const p = index.powers.find((x) => x.id === id);
        if (!def || !p) continue;
        if (!powerPrintedLevelEligibleForSlot(p, def)) {
          errors.push(
            `Power "${p.name}" is above the printed level allowed for "${def.label}" (level ${def.gainLevel} or lower only).`
          );
        }
        if (!powerAllowedForHybridSlot(key, p, baseAid, baseBid)) {
          errors.push(`Power "${p.name}" is not legal for hybrid slot "${def.label}".`);
        }
      }
    }

    const selectedAttackHy = attackPowersHy.filter((p) => build.powerIds.includes(p.id));
    const selectedUtilityHy = utilityPowersHy.filter((p) => build.powerIds.includes(p.id));
    const countsHy = { atWill: 0, encounter: 0, daily: 0 };
    for (const p of selectedAttackHy) {
      const usage = normalizeUsage(p.usage);
      if (usage === "At-Will") countsHy.atWill += 1;
      if (usage === "Encounter") countsHy.encounter += 1;
      if (usage === "Daily") countsHy.daily += 1;
    }

    if (countsHy.atWill !== powerSlotRules.atWill) {
      errors.push(
        `Select exactly ${powerSlotRules.atWill} hybrid at-will attack power${powerSlotRules.atWill === 1 ? "" : "s"} for your level (currently ${countsHy.atWill}).`
      );
    }
    if (countsHy.encounter !== powerSlotRules.encounter) {
      errors.push(
        `Select exactly ${powerSlotRules.encounter} hybrid encounter attack power${powerSlotRules.encounter === 1 ? "" : "s"} for your level (currently ${countsHy.encounter}).`
      );
    }
    if (countsHy.daily !== powerSlotRules.daily) {
      errors.push(
        `Select exactly ${powerSlotRules.daily} hybrid daily attack power${powerSlotRules.daily === 1 ? "" : "s"} for your level (currently ${countsHy.daily}).`
      );
    }
    if (selectedUtilityHy.length !== powerSlotRules.utility) {
      errors.push(
        `Select exactly ${powerSlotRules.utility} hybrid utility power${powerSlotRules.utility === 1 ? "" : "s"} for your level (currently ${selectedUtilityHy.length}).`
      );
    }
  } else if (!isHybrid && build.classId) {
    warnings.push("Selected class is missing from normalized index.");
  }

  const raceNameById = new Map(index.races.map((r) => [r.id, r.name]));
  const classNameById = new Map(index.classes.map((c) => [c.id, c.name]));
  const skillNameById = new Map(index.skills.map((s) => [s.id, s.name]));
  const hybridNamesForPrereq = hybridBaseClassNames(index, build);
  const prereqClassOpts =
    hybridNamesForPrereq.length > 0 ? { additionalClassNamesForMatch: hybridNamesForPrereq } : undefined;
  const themes = index.themes;
  const paragonPaths = index.paragonPaths;
  const epicDestinies = index.epicDestinies;

  if (build.themeId) {
    const theme = themes.find((t) => t.id === build.themeId);
    if (!theme) {
      errors.push("Selected theme is not in the rules index.");
    } else {
      const ev = evaluatePrereqs(theme.prereqTokens, build, raceNameById, classNameById, skillNameById, prereqClassOpts);
      if (!ev.ok) {
        errors.push(...ev.reasons.map((r) => `Theme: ${r}`));
      }
    }
  }

  if (build.paragonPathId) {
    if (build.level < 11) {
      errors.push("Paragon path can only be selected at level 11 or higher.");
    } else {
      const path = paragonPaths.find((p) => p.id === build.paragonPathId);
      if (!path) {
        errors.push("Selected paragon path is not in the rules index.");
      } else {
        const ev = evaluatePrereqs(path.prereqTokens, build, raceNameById, classNameById, skillNameById, prereqClassOpts);
        if (!ev.ok) {
          errors.push(...ev.reasons.map((r) => `Paragon path: ${r}`));
        }
      }
    }
  }

  if (build.epicDestinyId) {
    if (build.level < 21) {
      errors.push("Epic destiny can only be selected at level 21 or higher.");
    } else {
      const destiny = epicDestinies.find((d) => d.id === build.epicDestinyId);
      if (!destiny) {
        errors.push("Selected epic destiny is not in the rules index.");
      } else {
        const ev = evaluatePrereqs(destiny.prereqTokens, build, raceNameById, classNameById, skillNameById, prereqClassOpts);
        if (!ev.ok) {
          errors.push(...ev.reasons.map((r) => `Epic destiny: ${r}`));
        }
      }
    }
  }

  const constructionPowerIds = collectCharacterPowerIdsForSelections(index, build);
  for (const pid of constructionPowerIds) {
    const pow = index.powers.find((p) => p.id === pid);
    const groups = pow?.powerSelectionGroups ?? [];
    for (const g of groups) {
      const picked = build.powerSelections?.[pid]?.[g.key];
      const legal = new Set(g.options.map((o) => o.id));
      if (!picked || !legal.has(picked)) {
        errors.push(`Power: ${pow?.name ?? pid} — select ${g.label}.`);
      }
    }
  }

  return { errors, warnings, classSkillRules, powerSlotRules, classDefenseBonuses };
}

