import { useEffect, useMemo, useRef, useState } from "react";
import { Ability, AsiChoices, CharacterBuild, Feat, Power, PrereqToken, RacialTrait, RulesIndex } from "../../rules/models";
import { defaultBuild } from "./defaultBuild";
import { loadBuild, saveBuild } from "./storage";
import { computeDerivedStats } from "../../rules/statCalculator";
import { resolveFeatOptions } from "../../rules/optionResolver";
import { applyAsiBonusesToScores, isHumanRace, requiredAsiMilestonesUpTo, totalFeatSlots } from "../../rules/advancement";
import {
  attackPowerBucketFromUsage,
  buildClassPowerSlotDefinitions,
  inferClassPowerSlotsFromPowerIds,
  orderedPowerIdsFromSlots,
  powerPrintedLevelEligibleForSlot,
  reconcileClassPowerSlotsForBuild,
  slotBucketSectionTitle
} from "../../rules/classPowerSlots";
import { getClassPowersForLevelRange, validateCharacterBuild } from "../../rules/characterValidator";
import {
  autoGrantedClassPowers,
  parseFeatAssociatedPowerNames,
  racePowerGroupsForRace,
  resolvePowersByLooseNames
} from "../../rules/grantedPowersQuery";
import { getChildTraitIdsForSubrace, getRaceSubraceData } from "../../rules/raceSubraces";
import { evaluatePrereqs } from "../../rules/prereqEvaluator";
import { applyRacialBonuses, getAbilityLabel, parseRaceAbilityBonusInfo } from "../../rules/abilityScores";
import { getRaceSecondarySelectSlots, selectableStartingLanguages } from "../../rules/raceRuleSelects";
import { resolveRacialTraitsForRace } from "../../rules/racialTraits";
import { getClassBuildOptions } from "../../rules/classBuildOptions";
import { autoGrantedTrainedSkillIds } from "../../rules/grantedSkillsQuery";
import { RulesRichText } from "./RulesRichText";
import { NEUTRAL_PAGE_BG } from "../../ui/tokens";
import {
  ensureSelectedEntityInFiltered,
  ensureSelectedFeatsInList,
  filterFeatOptions,
  FeatSortMode,
  getFeatFacetCategory,
  filterPowersByQuery,
  filterRulesEntitiesByQuery,
  sortFeatOptions
} from "./featPowerFilters";

interface Props {
  index: RulesIndex;
}

function renderPowerCard(power: Power, key?: string): JSX.Element {
  const raw = (power.raw || {}) as Record<string, unknown>;
  const specific = (power.raw?.specific as Record<string, unknown> | undefined) || {};
  const flavor = typeof raw.flavor === "string" ? raw.flavor : "";
  const body = typeof raw.body === "string" ? raw.body : "";
  const usage = String(specific["Power Usage"] || power.usage || "-");
  const powerType = String(specific["Power Type"] || "-");
  const level = power.level ?? null;
  const display = String(specific["Display"] || power.display || "").trim();
  const keywords = String(specific["Keywords"] || power.keywords || "").trim();
  const actionType = String(specific["Action Type"] || "").trim();
  const attackType = String(specific["Attack Type"] || "").trim();
  const target = String(specific["Target"] || "").trim();
  const trigger = String(specific["Trigger"] || "").trim();
  const requirement = String(specific["Requirement"] || "").trim();
  const hit = String(specific["Hit"] || "").trim();
  const miss = String(specific["Miss"] || "").trim();
  const effect = String(specific["Effect"] || "").trim();
  const special = String(specific["Special"] || "").trim();

  return (
    <article
      key={key || power.id}
      style={{
        border: "1px solid #dadde7",
        backgroundColor: "#fff",
        borderRadius: "8px",
        padding: "0.55rem 0.65rem",
        marginTop: "0.45rem"
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, color: "#1f2937" }}>{power.name}</div>
        <div style={{ fontSize: "0.78rem", color: "#374151" }}>
          {usage} {powerType !== "-" ? `• ${powerType}` : ""}
          {level != null && level > 0 ? ` • Lv ${level}` : ""}
        </div>
      </div>
      {display && <div style={{ fontSize: "0.78rem", color: "#4b5563", marginTop: "0.2rem" }}>{display}</div>}
      {keywords && (
        <div style={{ fontSize: "0.77rem", color: "#374151", marginTop: "0.2rem" }}>
          <strong>Keywords:</strong> {keywords}
        </div>
      )}
      {(actionType || attackType || target || trigger || requirement) && (
        <div style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "#374151", lineHeight: 1.45 }}>
          {actionType && <div><strong>Action:</strong> {actionType}</div>}
          {attackType && <div><strong>Range/Area:</strong> {attackType}</div>}
          {target && <div><strong>Target:</strong> {target}</div>}
          {trigger && <div><strong>Trigger:</strong> {trigger}</div>}
          {requirement && <div><strong>Requirement:</strong> {requirement}</div>}
        </div>
      )}
      {(hit || miss || effect || special) && (
        <div style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "#374151", lineHeight: 1.45 }}>
          {hit && <div><strong>Hit:</strong> {hit}</div>}
          {miss && <div><strong>Miss:</strong> {miss}</div>}
          {effect && <div><strong>Effect:</strong> {effect}</div>}
          {special && <div><strong>Special:</strong> {special}</div>}
        </div>
      )}
      {flavor && <p style={{ margin: "0.35rem 0 0 0", fontStyle: "italic", fontSize: "0.8rem", color: "#374151" }}>{flavor}</p>}
      {body && (
        <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "#444" }}>
          <RulesRichText text={body} paragraphStyle={{ fontSize: "0.8rem", color: "#444" }} listItemStyle={{ fontSize: "0.8rem", color: "#444" }} />
        </div>
      )}
    </article>
  );
}

const abilities: Array<keyof CharacterBuild["abilityScores"]> = ["STR", "CON", "DEX", "INT", "WIS", "CHA"];
const PHYSICAL_ABILITIES: Ability[] = ["STR", "CON", "DEX"];
const MENTAL_ABILITIES: Ability[] = ["INT", "WIS", "CHA"];
type BuilderTab = "race" | "class" | "abilities" | "skills" | "feats" | "powers" | "paths" | "equipment" | "summary";

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatAbilityMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function resolveSkillAbilityCode(keyAbility: string | null | undefined): keyof CharacterBuild["abilityScores"] | null {
  const raw = String(keyAbility || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith("STR") || raw.includes("STRENGTH")) return "STR";
  if (raw.startsWith("CON") || raw.includes("CONSTITUTION")) return "CON";
  if (raw.startsWith("DEX") || raw.includes("DEXTERITY")) return "DEX";
  if (raw.startsWith("INT") || raw.includes("INTELLIGENCE")) return "INT";
  if (raw.startsWith("WIS") || raw.includes("WISDOM")) return "WIS";
  if (raw.startsWith("CHA") || raw.includes("CHARISMA")) return "CHA";
  return null;
}

function calculateSkillScore(
  build: CharacterBuild,
  effectiveScores: CharacterBuild["abilityScores"],
  keyAbility: string | null | undefined,
  trained: boolean
): number | null {
  const ability = resolveSkillAbilityCode(keyAbility);
  if (!ability) return null;
  const abilityMod = Math.floor((effectiveScores[ability] - 10) / 2);
  const halfLevel = Math.floor(build.level / 2);
  const trainingBonus = trained ? 5 : 0;
  return abilityMod + halfLevel + trainingBonus;
}

const POINT_BUY_RELATIVE_TO_10: Record<number, number> = {
  8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 9, 17: 12, 18: 16
};
const DEFAULT_POINT_BUY_BUDGET = 22;

/** Neutral grey panels for visual hierarchy (builder chrome only). */
const ui = {
  page: {
    display: "grid" as const,
    gridTemplateColumns: "2fr 1fr",
    gap: "1.25rem",
    alignItems: "start" as const,
    padding: "1.25rem",
    minHeight: "100vh",
    boxSizing: "border-box" as const,
    fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: NEUTRAL_PAGE_BG
  },
  mainColumn: {
    backgroundColor: "#ffffff",
    border: "1px solid #c8c9d0",
    borderRadius: "12px",
    padding: "1.25rem 1.35rem",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)"
  },
  sidebarColumn: {
    backgroundColor: "#eceef2",
    border: "1px solid #c8c9d0",
    borderRadius: "12px",
    padding: "1.25rem 1.35rem",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)"
  },
  blockTitle: {
    backgroundColor: "#f6f6f8",
    border: "1px solid #e2e3e7",
    borderRadius: "10px",
    padding: "1rem 1.1rem",
    marginBottom: "0.9rem"
  },
  blockTabs: {
    backgroundColor: "#ebecef",
    border: "1px solid #d9dade",
    borderRadius: "10px",
    padding: "0.55rem 0.65rem",
    marginBottom: "1rem"
  },
  blockContent: {
    backgroundColor: "#f5f5f7",
    border: "1px solid #dcdde2",
    borderRadius: "10px",
    padding: "1rem 1.1rem"
  },
  blockInset: {
    backgroundColor: "#f0f0f3",
    border: "1px solid #d5d6dc",
    borderRadius: "8px",
    padding: "0.65rem 0.85rem"
  },
  blockSheetSection: {
    backgroundColor: "#e2e4e9",
    border: "1px solid #cdd0d7",
    borderRadius: "8px",
    padding: "0.75rem 0.9rem",
    marginTop: "0.75rem"
  }
};

function exportBuild(build: CharacterBuild): void {
  const blob = new Blob([JSON.stringify(build, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${build.name || "character"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBuildFromFile(file: File, onLoaded: (build: CharacterBuild) => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      onLoaded(JSON.parse(String(reader.result)) as CharacterBuild);
    } catch {
      alert("Could not parse character JSON file.");
    }
  };
  reader.readAsText(file);
}

export function CharacterBuilderApp({ index }: Props): JSX.Element {
  const SUBRACE_SELECTION_KEY = "subrace";
  const [build, setBuild] = useState<CharacterBuild>(() => loadBuild() || defaultBuild);
  const prevAutoGrantedSkillIdsRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<BuilderTab>("race");
  const [featSearch, setFeatSearch] = useState("");
  const [showInvalidFeats, setShowInvalidFeats] = useState(false);
  const [featTierFilter, setFeatTierFilter] = useState<"all" | "HEROIC" | "PARAGON" | "EPIC">("all");
  const [featCategoryFilter, setFeatCategoryFilter] = useState<string>("all");
  const [featSourceFilter, setFeatSourceFilter] = useState<string>("all");
  const [featSortMode, setFeatSortMode] = useState<FeatSortMode>("tier-alpha");
  const [powerSearch, setPowerSearch] = useState("");
  const [themeSearch, setThemeSearch] = useState("");
  const [paragonSearch, setParagonSearch] = useState("");
  const [epicSearch, setEpicSearch] = useState("");

  const selectedRace = index.races.find((r) => r.id === build.raceId);
  const selectedClass = index.classes.find((c) => c.id === build.classId);
  const selectedTheme = index.themes.find((t) => t.id === build.themeId);
  const selectedParagonPath = index.paragonPaths.find((p) => p.id === build.paragonPathId);
  const selectedEpicDestiny = index.epicDestinies.find((d) => d.id === build.epicDestinyId);
  const selectedArmor = index.armors.find((a) => a.id === build.armorId);
  const selectedShield = index.armors.find((a) => a.id === build.shieldId);
  const raceSpecific = (selectedRace?.raw?.specific as Record<string, unknown> | undefined) || {};
  const classSpecific = (selectedClass?.raw?.specific as Record<string, unknown> | undefined) || {};
  const classBuildOptions = useMemo(() => getClassBuildOptions(index, selectedClass), [index, selectedClass]);
  const selectedClassBuildOption = useMemo(() => {
    const id = build.classSelections?.buildOptionId || build.classSelections?.buildOption;
    if (!id) return undefined;
    return classBuildOptions.find((o) => o.id === id || o.name === id);
  }, [build.classSelections, classBuildOptions]);
  const autoGrantedSkillIds = useMemo(() => autoGrantedTrainedSkillIds(index, build), [index, build]);
  const autoGrantedSkillIdSet = useMemo(() => new Set(autoGrantedSkillIds), [autoGrantedSkillIds]);

  const raceAbilityBonusInfo = useMemo(() => parseRaceAbilityBonusInfo(selectedRace), [selectedRace]);
  const raceSecondarySlots = useMemo(() => getRaceSecondarySelectSlots(selectedRace), [selectedRace]);
  const bonusLanguageOptions = useMemo(
    () =>
      selectableStartingLanguages(index.languages ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [index.languages]
  );
  const racialTraitById = useMemo(
    () => new Map<string, RacialTrait>((index.racialTraits ?? []).map((t) => [t.id, t])),
    [index.racialTraits]
  );
  const racialTraitRows = useMemo(
    () => resolveRacialTraitsForRace(selectedRace, racialTraitById),
    [selectedRace, racialTraitById]
  );
  const raceSubraceData = useMemo(
    () => getRaceSubraceData(selectedRace, racialTraitById),
    [selectedRace, racialTraitById]
  );
  const selectedSubraceTrait = useMemo(() => {
    const pickedId = build.raceSelections?.[SUBRACE_SELECTION_KEY];
    if (!pickedId || !raceSubraceData) return undefined;
    return raceSubraceData.options.find((o) => o.id === pickedId);
  }, [build.raceSelections, raceSubraceData]);
  const selectedSubraceChildTraitIds = useMemo(
    () => getChildTraitIdsForSubrace(selectedSubraceTrait),
    [selectedSubraceTrait]
  );
  const displayedRacialTraitRows = useMemo(() => {
    const rows = [...racialTraitRows];
    const seen = new Set(rows.map((r) => r.id));
    if (selectedSubraceTrait && !seen.has(selectedSubraceTrait.id)) {
      rows.push({ id: selectedSubraceTrait.id, trait: selectedSubraceTrait });
      seen.add(selectedSubraceTrait.id);
    }
    for (const id of selectedSubraceChildTraitIds) {
      if (seen.has(id)) continue;
      rows.push({ id, trait: racialTraitById.get(id) });
      seen.add(id);
    }
    return rows;
  }, [racialTraitRows, selectedSubraceTrait, selectedSubraceChildTraitIds, racialTraitById]);
  const scoresAfterLevel = useMemo(
    () => applyAsiBonusesToScores(build.abilityScores, build.level, build.asiChoices),
    [build.abilityScores, build.level, build.asiChoices]
  );
  const effectiveAbilityScores = useMemo(
    () => applyRacialBonuses(scoresAfterLevel, raceAbilityBonusInfo, build.racialAbilityChoice),
    [scoresAfterLevel, build.racialAbilityChoice, raceAbilityBonusInfo]
  );
  const effectiveBuild = useMemo(() => ({ ...build, abilityScores: effectiveAbilityScores }), [build, effectiveAbilityScores]);
  const legality = useMemo(() => validateCharacterBuild(index, build), [index, build]);
  const derived = useMemo(
    () => computeDerivedStats(effectiveBuild, selectedRace, selectedClass, selectedArmor, selectedShield, legality.classDefenseBonuses),
    [effectiveBuild, selectedRace, selectedClass, selectedArmor, selectedShield, legality.classDefenseBonuses]
  );

  const featOptions = useMemo(() => resolveFeatOptions(index, effectiveBuild), [index, effectiveBuild]);
  const allLegalFeats = useMemo(() => featOptions.filter((f) => f.legal), [featOptions]);
  const displayedFeatOptions = useMemo(
    () => (showInvalidFeats ? featOptions : featOptions.filter((f) => f.legal)),
    [featOptions, showInvalidFeats]
  );
  const expectedFeatCount = useMemo(
    () => totalFeatSlots(build.level, isHumanRace(selectedRace?.name)),
    [build.level, selectedRace?.name]
  );
  const filteredFeatRows = useMemo(() => {
    const filtered = filterFeatOptions(displayedFeatOptions, {
      query: featSearch,
      tier: featTierFilter,
      category: featCategoryFilter,
      source: featSourceFilter
    });
    const sorted = sortFeatOptions(filtered, featSortMode);
    return ensureSelectedFeatsInList(sorted, build.featIds, featOptions);
  }, [displayedFeatOptions, featSearch, featTierFilter, featCategoryFilter, featSourceFilter, featSortMode, build.featIds, featOptions]);
  const featCategoryOptions = useMemo(() => {
    const values = new Set<string>();
    // Keep category filter usable even if metadata is stale/cached in a running session.
    for (const fallback of ["Class", "Racial", "Defense", "General", "Weapon", "Implement", "Skill", "Armor", "Combat", "Healing", "Mobility", "Power"]) {
      values.add(fallback);
    }
    for (const row of featOptions) values.add(getFeatFacetCategory(row.item));
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [featOptions]);
  const featSourceOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of featOptions) {
      const src = String(row.item.source || "").trim();
      if (src) values.add(src);
    }
    return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [featOptions]);
  const classAttackPowers = useMemo(
    () => getClassPowersForLevelRange(index, build.classId, build.level, "attack"),
    [index, build.classId, build.level]
  );
  const classUtilityPowers = useMemo(
    () => getClassPowersForLevelRange(index, build.classId, build.level, "utility"),
    [index, build.classId, build.level]
  );
  const powerSlotDefs = useMemo(
    () => buildClassPowerSlotDefinitions(build.level, isHumanRace(selectedRace?.name)),
    [build.level, selectedRace?.name]
  );
  const racePowerGroups = useMemo(
    () =>
      racePowerGroupsForRace(selectedRace, racialTraitById, [
        ...(selectedSubraceTrait ? [selectedSubraceTrait.id] : []),
        ...selectedSubraceChildTraitIds
      ]),
    [selectedRace, racialTraitById, selectedSubraceTrait, selectedSubraceChildTraitIds]
  );
  const classAutoGrantedPowers = useMemo(() => autoGrantedClassPowers(index, build.classId), [index, build.classId]);
  const featAssociatedPowers = useMemo(() => {
    const rows: Array<{ feat: Feat; powers: Power[] }> = [];
    for (const id of build.featIds) {
      const feat = index.feats.find((f) => f.id === id);
      if (!feat) continue;
      const names = parseFeatAssociatedPowerNames(feat);
      if (names.length === 0) continue;
      const powers = resolvePowersByLooseNames(index, names);
      if (powers.length > 0) rows.push({ feat, powers });
    }
    return rows;
  }, [index, build.featIds]);
  const selectedClassSkillNamesLower = new Set((legality.classSkillRules?.classSkillNames || []).map((s) => s.toLowerCase()));
  const skillsSortedAll = useMemo(
    () => [...index.skills].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.skills]
  );
  const armorOptions = useMemo(() => index.armors.filter((a) => (a.armorType || "").toLowerCase() !== "shield"), [index.armors]);
  const shieldOptions = useMemo(() => index.armors.filter((a) => (a.armorType || "").toLowerCase() === "shield"), [index.armors]);
  const abilityLoreByCode = useMemo(() => {
    const m = new Map<Ability, string>();
    for (const entry of index.abilityScores) {
      if (entry.abilityCode && entry.body) m.set(entry.abilityCode, entry.body);
    }
    return m;
  }, [index.abilityScores]);

  const raceNameById = useMemo(() => new Map(index.races.map((r) => [r.id, r.name])), [index.races]);
  const classNameById = useMemo(() => new Map(index.classes.map((c) => [c.id, c.name])), [index.classes]);
  const skillNameById = useMemo(() => new Map(index.skills.map((s) => [s.id, s.name])), [index.skills]);

  const themesSorted = useMemo(
    () => [...index.themes].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.themes]
  );
  const paragonPathsSorted = useMemo(
    () => [...index.paragonPaths].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.paragonPaths]
  );
  const epicDestiniesSorted = useMemo(
    () => [...index.epicDestinies].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.epicDestinies]
  );

  const filteredThemes = useMemo(
    () => ensureSelectedEntityInFiltered(filterRulesEntitiesByQuery(themesSorted, themeSearch), build.themeId, themesSorted),
    [themesSorted, themeSearch, build.themeId]
  );
  const filteredParagonPaths = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        filterRulesEntitiesByQuery(paragonPathsSorted, paragonSearch),
        build.paragonPathId,
        paragonPathsSorted
      ),
    [paragonPathsSorted, paragonSearch, build.paragonPathId]
  );
  const filteredEpicDestinies = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        filterRulesEntitiesByQuery(epicDestiniesSorted, epicSearch),
        build.epicDestinyId,
        epicDestiniesSorted
      ),
    [epicDestiniesSorted, epicSearch, build.epicDestinyId]
  );

  const selectedFeats = useMemo((): Feat[] => {
    return build.featIds.map((id) => index.feats.find((f) => f.id === id)).filter((f): f is Feat => Boolean(f));
  }, [index.feats, build.featIds]);

  const selectedFeatLore = useMemo(() => {
    const selectedFeat = selectedFeats[0];
    if (!selectedFeat) return null;
    const raw = selectedFeat.raw as Record<string, unknown>;
    const flavor = typeof raw.flavor === "string" ? raw.flavor : "";
    const body = typeof raw.body === "string" ? raw.body : "";
    const specific = (raw.specific as Record<string, unknown> | undefined) || {};
    const shortFromSpecific = typeof specific["Short Description"] === "string" ? specific["Short Description"] : "";
    const shortLine = selectedFeat.shortDescription || shortFromSpecific;
    if (!flavor && !body && !shortLine) return null;
    return { flavor, body, shortLine };
  }, [selectedFeats]);

  const pointBuy = useMemo(() => {
    const BASE_PACKAGE_VALUE = -2;
    let relativeTotal = 0;
    const invalidScores: string[] = [];
    for (const ability of abilities) {
      const score = build.abilityScores[ability];
      const value = POINT_BUY_RELATIVE_TO_10[score];
      if (value === undefined) invalidScores.push(`${ability}=${score}`);
      else relativeTotal += value;
    }
    const total = relativeTotal - BASE_PACKAGE_VALUE;
    const budget = build.pointBuyBudget ?? DEFAULT_POINT_BUY_BUDGET;
    return { total, budget, remaining: budget - total, invalidScores };
  }, [build.abilityScores, build.pointBuyBudget]);

  function evalOptionWithLevel(tokens: PrereqToken[], minLevel: number): { legal: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (minLevel > 0 && build.level < minLevel) {
      reasons.push(`Requires level ${minLevel}+`);
    }
    const ev = evaluatePrereqs(tokens, build, raceNameById, classNameById, skillNameById);
    if (!ev.ok) reasons.push(...ev.reasons);
    return { legal: reasons.length === 0, reasons };
  }

  function mapErrorToTab(message: string): BuilderTab {
    const m = message.toLowerCase();
    if (
      m.startsWith("theme:") ||
      m.startsWith("paragon path:") ||
      m.startsWith("epic destiny:") ||
      m.includes("paragon path can only") ||
      m.includes("epic destiny can only") ||
      m.includes("selected theme is not") ||
      m.includes("selected paragon path is not") ||
      m.includes("selected epic destiny is not")
    ) {
      return "paths";
    }
    if (m === "choose a race." || m.startsWith("race:")) return "race";
    if (m === "choose a class.") return "class";
    if (m.includes("point-buy") || m.includes("ability increases")) return "abilities";
    if (m.includes("ability") || m.includes("score")) return "abilities";
    if (m.includes("trained") || m.includes("skill")) return "skills";
    if (m.includes("feat")) return "feats";
    if (m.includes("utility power")) return "powers";
    if (m.includes("at-will") || m.includes("encounter") || m.includes("daily") || m.includes("power")) return "powers";
    if (m.includes("armor") || m.includes("shield") || m.includes("proficiency")) return "equipment";
    return "summary";
  }

  const tabStatuses = useMemo(() => {
    const errorsByTab = legality.errors.reduce<Record<BuilderTab, number>>(
      (acc, e) => {
        acc[mapErrorToTab(e)] += 1;
        return acc;
      },
      { race: 0, class: 0, abilities: 0, skills: 0, feats: 0, powers: 0, paths: 0, equipment: 0, summary: 0 }
    );

    const requiresRacialChoice = raceAbilityBonusInfo.chooseOne.length > 0 && !build.racialAbilityChoice;
    const statuses: Record<BuilderTab, "complete" | "incomplete"> = {
      race: !!selectedRace && errorsByTab.race === 0 ? "complete" : "incomplete",
      class: !!selectedClass && errorsByTab.class === 0 ? "complete" : "incomplete",
      abilities:
        errorsByTab.abilities === 0 &&
        pointBuy.remaining >= 0 &&
        pointBuy.invalidScores.length === 0 &&
        !requiresRacialChoice
          ? "complete"
          : "incomplete",
      skills: !!selectedClass && errorsByTab.skills === 0 ? "complete" : "incomplete",
      feats:
        errorsByTab.feats === 0 && build.featIds.length === expectedFeatCount ? "complete" : "incomplete",
      powers: !!selectedClass && errorsByTab.powers === 0 ? "complete" : "incomplete",
      paths: errorsByTab.paths === 0 ? "complete" : "incomplete",
      equipment: errorsByTab.equipment === 0 ? "complete" : "incomplete",
      summary: legality.errors.length === 0 ? "complete" : "incomplete"
    };
    return statuses;
  }, [
    legality.errors,
    selectedRace,
    selectedClass,
    build.trainedSkillIds.length,
    build.featIds.length,
    build.powerIds.length,
    pointBuy.remaining,
    pointBuy.invalidScores.length,
    raceAbilityBonusInfo.chooseOne.length,
    build.racialAbilityChoice,
    build.level,
    build.themeId,
    build.paragonPathId,
    build.epicDestinyId,
    expectedFeatCount
  ]);

  function renderTabStatus(status: "complete" | "incomplete"): string {
    return status === "complete" ? "Complete" : "Incomplete";
  }

  function updateBuild(next: CharacterBuild): void {
    setBuild(next);
    saveBuild(next);
  }

  function commitClassPowerSlot(slotKey: string, powerId: string): void {
    const human = isHumanRace(selectedRace?.name);
    const defs = buildClassPowerSlotDefinitions(build.level, human);
    const nextSlots: Record<string, string> = { ...(build.classPowerSlots || {}) };
    if (powerId) nextSlots[slotKey] = powerId;
    else delete nextSlots[slotKey];
    const trimmed = Object.keys(nextSlots).length ? nextSlots : undefined;
    updateBuild({ ...build, classPowerSlots: trimmed, powerIds: orderedPowerIdsFromSlots(defs, trimmed) });
  }

  useEffect(() => {
    if (!index || !build.classId) return;
    setBuild((prev) => {
      if (prev.classPowerSlots || prev.powerIds.length === 0) return prev;
      const human = isHumanRace(index.races.find((r) => r.id === prev.raceId)?.name);
      const defs = buildClassPowerSlotDefinitions(prev.level, human);
      const inferred = inferClassPowerSlotsFromPowerIds(defs, prev.powerIds, index, prev.classId, prev.level);
      if (!inferred) return prev;
      const next = { ...prev, classPowerSlots: inferred, powerIds: orderedPowerIdsFromSlots(defs, inferred) };
      saveBuild(next);
      return next;
    });
  }, [index, build.classId, build.level, build.raceId, build.powerIds.join(","), build.classPowerSlots === undefined]);

  useEffect(() => {
    const prevAuto = prevAutoGrantedSkillIdsRef.current;
    const currentAuto = new Set(autoGrantedSkillIds);
    const manual = build.trainedSkillIds.filter((id) => !prevAuto.has(id));
    const next = [...new Set([...manual, ...autoGrantedSkillIds])];
    prevAutoGrantedSkillIdsRef.current = currentAuto;
    if (next.length === build.trainedSkillIds.length && next.every((x, i) => x === build.trainedSkillIds[i])) {
      return;
    }
    updateBuild({ ...build, trainedSkillIds: next });
  }, [autoGrantedSkillIds.join("|"), build.trainedSkillIds.join("|")]);

  return (
    <div style={ui.page}>
      <div style={ui.mainColumn}>
        <div style={ui.blockTitle}>
          <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.35rem", fontWeight: 700, color: "#1a1a1e" }}>D&amp;D 4e Character Builder</h2>
          <label style={{ display: "block", fontSize: "0.9rem", color: "#3a3a42" }}>
            Character Name
            <input
              value={build.name}
              onChange={(e) => updateBuild({ ...build, name: e.target.value })}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.5rem",
                border: "1px solid #c4c5cc",
                borderRadius: "6px",
                backgroundColor: "#fff",
                boxSizing: "border-box"
              }}
            />
          </label>
          <label style={{ display: "block", marginTop: "0.65rem", fontSize: "0.9rem", color: "#3a3a42" }}>
            Level (1–30)
            <input
              type="number"
              min={1}
              max={30}
              value={build.level}
              onChange={(e) => {
                const lv = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                const milestoneKeys = new Set(requiredAsiMilestonesUpTo(lv).map(String));
                const asiNext: AsiChoices = { ...(build.asiChoices || {}) };
                for (const k of Object.keys(asiNext)) {
                  if (!milestoneKeys.has(k)) delete asiNext[k];
                }
                const maxFeats = totalFeatSlots(lv, isHumanRace(selectedRace?.name));
                const nextBase: CharacterBuild = {
                  ...build,
                  level: lv,
                  paragonPathId: lv < 11 ? undefined : build.paragonPathId,
                  epicDestinyId: lv < 21 ? undefined : build.epicDestinyId,
                  featIds: build.featIds.slice(0, maxFeats),
                  asiChoices: Object.keys(asiNext).length > 0 ? asiNext : undefined
                };
                const human = isHumanRace(selectedRace?.name);
                const { classPowerSlots, powerIds } = reconcileClassPowerSlotsForBuild(nextBase, lv, human, index);
                updateBuild({ ...nextBase, classPowerSlots, powerIds });
              }}
              style={{
                width: "4.75rem",
                marginTop: "0.25rem",
                padding: "0.4rem 0.5rem",
                border: "1px solid #c4c5cc",
                borderRadius: "6px",
                backgroundColor: "#fff",
                boxSizing: "border-box",
                fontVariantNumeric: "tabular-nums"
              }}
            />
          </label>
        </div>
        <div style={ui.blockTabs}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
            {[
              ["race", "Race"],
              ["class", "Class"],
              ["abilities", "Ability Scores"],
              ["skills", "Skills"],
              ["feats", "Feats"],
              ["powers", "Powers"],
              ["paths", "Theme & paths"],
              ["equipment", "Equipment"],
              ["summary", "Summary"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as BuilderTab)}
                style={{
                  border: activeTab === id ? "1px solid #9b9ca8" : "1px solid #cfd0d6",
                  background: activeTab === id ? "#d8d9df" : "#f7f7f9",
                  color: "#1e1e24",
                  textAlign: "left",
                  borderRadius: "8px",
                  padding: "0.45rem 0.55rem",
                  cursor: "pointer",
                  minWidth: "7.5rem",
                  boxShadow: activeTab === id ? "inset 0 1px 0 rgba(255,255,255,0.65)" : "none"
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{label}</div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: tabStatuses[id as BuilderTab] === "complete" ? "#1a6b1a" : "#5c5c66",
                    marginTop: "0.12rem"
                  }}
                >
                  {renderTabStatus(tabStatuses[id as BuilderTab])}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={ui.blockContent}>
        {activeTab === "race" && (
          <div>
            <h3>Race</h3>
            <select
              value={build.raceId || ""}
              onChange={(e) => {
                const raceId = e.target.value || undefined;
                const race = raceId ? index.races.find((r) => r.id === raceId) : undefined;
                const human = isHumanRace(race?.name);
                const nextBase: CharacterBuild = {
                  ...build,
                  raceId,
                  racialAbilityChoice: undefined,
                  raceSelections: undefined
                };
                const { classPowerSlots, powerIds } = reconcileClassPowerSlotsForBuild(
                  nextBase,
                  build.level,
                  human,
                  index
                );
                updateBuild({ ...nextBase, classPowerSlots, powerIds });
              }}
              style={{ width: "100%" }}
            >
              <option value="">Select race</option>
              {index.races.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}
            </select>
            {selectedRace && (
              <div style={{ ...ui.blockInset, marginTop: "0.65rem" }}>
                <p style={{ margin: 0 }}><strong>Source:</strong> {selectedRace.source || "Unknown"}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Speed:</strong> {String(raceSpecific["Speed"] || selectedRace.speed || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Size:</strong> {String(raceSpecific["Size"] || selectedRace.size || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Ability Scores:</strong> {String(raceSpecific["Ability Scores"] || selectedRace.abilitySummary || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Languages:</strong> {String(raceSpecific["Languages"] || selectedRace.languages || "-")}</p>
                {displayedRacialTraitRows.length > 0 && (
                  <div style={{ marginTop: "0.65rem" }}>
                    <h4 style={{ margin: "0 0 0.45rem 0", fontSize: "0.95rem", color: "#333" }}>Racial traits</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      {displayedRacialTraitRows.map(({ id, trait }) => (
                        <details
                          key={id}
                          style={{
                            backgroundColor: "#f8f8fa",
                            border: "1px solid #e0e1e6",
                            borderRadius: "8px",
                            padding: "0.45rem 0.55rem"
                          }}
                        >
                          <summary
                            style={{
                              fontWeight: 600,
                              cursor: "pointer",
                              fontSize: "0.88rem",
                              lineHeight: 1.4
                            }}
                          >
                            {trait?.name || id}
                            {trait?.shortDescription ? (
                              <span style={{ fontWeight: 400, color: "#555" }}> — {trait.shortDescription}</span>
                            ) : null}
                          </summary>
                          <div style={{ marginTop: "0.4rem", fontSize: "0.86rem", lineHeight: 1.45 }}>
                            {trait?.source && (
                              <p style={{ margin: "0 0 0.35rem 0", color: "#666" }}>
                                <strong>Source:</strong> {trait.source}
                              </p>
                            )}
                            {!trait && (
                              <p style={{ margin: 0, color: "#a61" }}>
                                This trait is listed on the race but was not found in the loaded rules data ({id}).
                              </p>
                            )}
                            {trait?.body ? <RulesRichText text={trait.body} /> : null}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                {racePowerGroups.some((g) => g.powerIds.length > 0) && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={{ margin: "0 0 0.45rem 0", fontSize: "0.95rem", color: "#333" }}>Granted powers</h4>
                    {racePowerGroups
                      .filter((g) => g.powerIds.length > 0)
                      .map((g) => (
                        <div key={`race-powers-${g.traitId}`} style={{ marginBottom: "0.55rem" }}>
                          <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.84rem", color: "#374151" }}>
                            <strong>{g.traitName}</strong>
                            {g.choiceOnly ? " (choose one)" : ""}
                          </p>
                          {g.powerIds
                            .map((pid) => index.powers.find((p) => p.id === pid))
                            .filter((p): p is Power => !!p)
                            .map((p) => renderPowerCard(p, `race-tab-${g.traitId}-${p.id}`))}
                        </div>
                      ))}
                  </div>
                )}
                {selectedRace.raw.flavor && (
                  <p style={{ margin: "0.5rem 0 0 0" }}>
                    <strong>Flavor:</strong> {String(selectedRace.raw.flavor)}
                  </p>
                )}
                {raceSpecific["Short Description"] && (
                  <p style={{ margin: "0.25rem 0 0 0" }}>
                    <strong>Short Description:</strong> {String(raceSpecific["Short Description"])}
                  </p>
                )}
                {selectedRace.raw.body && (
                  <details open style={{ marginTop: "0.5rem" }}>
                    <summary>Lore Overview</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(selectedRace.raw.body)} />
                    </div>
                  </details>
                )}
                {raceSpecific["Physical Qualities"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary>Physical Qualities</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(raceSpecific["Physical Qualities"])} />
                    </div>
                  </details>
                )}
                {raceSpecific["Playing"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary>Playing This Race</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(raceSpecific["Playing"])} />
                    </div>
                  </details>
                )}
                {(!!raceSubraceData || raceAbilityBonusInfo.chooseOne.length > 0 || raceSecondarySlots.length > 0) && (
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid #d5d6dc" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#333" }}>Race choices</h4>
                    {raceSubraceData && (
                      <label style={{ display: "block", marginBottom: "0.75rem" }}>
                        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                          {raceSubraceData.parentTraitName}
                        </span>
                        <select
                          value={build.raceSelections?.[SUBRACE_SELECTION_KEY] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const next = { ...(build.raceSelections || {}) };
                            if (v) next[SUBRACE_SELECTION_KEY] = v;
                            else delete next[SUBRACE_SELECTION_KEY];
                            const keys = Object.keys(next);
                            updateBuild({ ...build, raceSelections: keys.length ? next : undefined });
                          }}
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                        >
                          <option value="">Select subrace…</option>
                          {raceSubraceData.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {raceAbilityBonusInfo.chooseOne.length > 0 && (
                      <label style={{ display: "block", marginBottom: raceSecondarySlots.length > 0 ? "0.75rem" : 0 }}>
                        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                          Racial ability (+2) — choose one
                        </span>
                        <select
                          value={build.racialAbilityChoice || ""}
                          onChange={(e) =>
                            updateBuild({
                              ...build,
                              racialAbilityChoice: (e.target.value || undefined) as CharacterBuild["racialAbilityChoice"]
                            })
                          }
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                        >
                          <option value="">Select ability…</option>
                          {raceAbilityBonusInfo.chooseOne.map((ability) => (
                            <option key={ability} value={ability}>
                              {getAbilityLabel(ability)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {raceSecondarySlots.map((slot) => (
                      <label key={slot.key} style={{ display: "block", marginBottom: "0.65rem" }}>
                        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                          {slot.label}
                        </span>
                        {slot.kind === "language" && (
                          <select
                            value={(build.raceSelections || {})[slot.key] || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = { ...(build.raceSelections || {}) };
                              if (v) next[slot.key] = v;
                              else delete next[slot.key];
                              const keys = Object.keys(next);
                              updateBuild({ ...build, raceSelections: keys.length ? next : undefined });
                            }}
                            style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                          >
                            <option value="">Select language…</option>
                            {bonusLanguageOptions.map((lang) => (
                              <option key={lang.id} value={lang.id}>
                                {lang.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {slot.kind === "skillBonus" && (
                          <select
                            value={(build.raceSelections || {})[slot.key] || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = { ...(build.raceSelections || {}) };
                              if (v) next[slot.key] = v;
                              else delete next[slot.key];
                              const keys = Object.keys(next);
                              updateBuild({ ...build, raceSelections: keys.length ? next : undefined });
                            }}
                            style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                          >
                            <option value="">Select skill…</option>
                            {skillsSortedAll.map((sk) => (
                              <option key={sk.id} value={sk.id}>
                                {sk.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "class" && (
          <div>
            <h3>Class</h3>
            <select
              value={build.classId || ""}
              onChange={(e) =>
                updateBuild({
                  ...build,
                  classId: e.target.value || undefined,
                  classSelections: undefined,
                  powerIds: [],
                  classPowerSlots: undefined
                })
              }
              style={{ width: "100%" }}
            >
              <option value="">Select class</option>
              {index.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
            {selectedClass && (
              <div style={{ ...ui.blockInset, marginTop: "0.65rem" }}>
                <p style={{ margin: 0 }}><strong>Role:</strong> {String(classSpecific["Role"] || selectedClass.role || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Power Source:</strong> {String(classSpecific["Power Source"] || selectedClass.powerSource || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Key Abilities:</strong> {String(classSpecific["Key Abilities"] || selectedClass.keyAbilities || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Hit Points at 1st Level:</strong> {String(classSpecific["Hit Points at 1st Level"] || selectedClass.hitPointsAt1 || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Class Skills:</strong> {String(classSpecific["Class Skills"] || "-")}</p>
                {selectedClass.raw.flavor && (
                  <p style={{ margin: "0.5rem 0 0 0" }}>
                    <strong>Flavor:</strong> {String(selectedClass.raw.flavor)}
                  </p>
                )}
                {selectedClass.raw.body && (
                  <details open style={{ marginTop: "0.5rem" }}>
                    <summary>Class Lore Overview</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(selectedClass.raw.body)} />
                    </div>
                  </details>
                )}
                {classSpecific["Build Options"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary>Build Options</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(classSpecific["Build Options"])} />
                    </div>
                  </details>
                )}
                {classAutoGrantedPowers.length > 0 && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={{ margin: "0 0 0.45rem 0", fontSize: "0.95rem", color: "#333" }}>Granted powers</h4>
                    {classAutoGrantedPowers.map((p) => renderPowerCard(p, `class-tab-${p.id}`))}
                  </div>
                )}
                {classBuildOptions.length > 0 && (
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid #d5d6dc" }}>
                    <h4 style={{ margin: "0 0 0.45rem 0", fontSize: "0.95rem", color: "#333" }}>Class choices</h4>
                    <label style={{ display: "block", maxWidth: "28rem" }}>
                      <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                        Build option
                      </span>
                      <select
                        value={build.classSelections?.buildOptionId || build.classSelections?.buildOption || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const next = { ...(build.classSelections || {}) };
                          if (v) {
                            next.buildOptionId = v;
                            const picked = classBuildOptions.find((o) => o.id === v);
                            if (picked) next.buildOption = picked.name;
                          } else {
                            delete next.buildOptionId;
                            delete next.buildOption;
                          }
                          const keys = Object.keys(next);
                          updateBuild({ ...build, classSelections: keys.length ? next : undefined });
                        }}
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                      >
                        <option value="">Select build option…</option>
                        {classBuildOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.parentFeatureName ? `${opt.parentFeatureName}: ${opt.name}` : opt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedClassBuildOption && (
                      <div style={{ marginTop: "0.55rem" }}>
                        <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.85rem", color: "#333" }}>
                          <strong>Selected:</strong> {selectedClassBuildOption.name}
                        </p>
                        {selectedClassBuildOption.shortDescription && (
                          <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.82rem", color: "#444" }}>
                            {selectedClassBuildOption.shortDescription}
                          </p>
                        )}
                        {selectedClassBuildOption.body && (
                          <div style={{ fontSize: "0.82rem", color: "#444" }}>
                            <RulesRichText
                              text={selectedClassBuildOption.body}
                              paragraphStyle={{ fontSize: "0.82rem", color: "#444" }}
                              listItemStyle={{ fontSize: "0.82rem", color: "#444" }}
                            />
                          </div>
                        )}
                        {selectedClassBuildOption.powerIds.length > 0 && (
                          <div style={{ marginTop: "0.45rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151" }}>Granted powers</div>
                            {selectedClassBuildOption.powerIds
                              .map((pid) => index.powers.find((p) => p.id === pid))
                              .filter((p): p is Power => !!p)
                              .map((p) => renderPowerCard(p, `class-build-${selectedClassBuildOption.id}-${p.id}`))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {classSpecific["Role"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary>Role Details</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(classSpecific["Role"])} />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "abilities" && (
          <div>
            <h3>Ability Scores</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "#555", fontSize: "0.9rem", lineHeight: 1.45 }}>
              Set <strong>base</strong> scores (8–18) using point buy. Modifiers below use your <strong>final</strong> score after level-based increases, then racial bonuses—those are what checks and attacks use.
            </p>

            {build.level >= 11 && (
              <p style={{ ...ui.blockInset, marginBottom: "0.75rem", backgroundColor: "#f0f4ff", fontSize: "0.88rem", color: "#333" }}>
                <strong>PHB tier bumps:</strong> At 11th level and 21st level, each ability score gains +1 automatically (included below). At 4, 8, 14, 18, 24, and 28, assign two different +1s in{" "}
                <strong>Level-up ability increases</strong>.
              </p>
            )}

            {(raceAbilityBonusInfo.fixed.length > 0 || raceAbilityBonusInfo.chooseOne.length > 0) && (
              <div
                style={{
                  ...ui.blockInset,
                  marginBottom: "0.75rem",
                  backgroundColor: "#fafbfc",
                  fontSize: "0.88rem"
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>Racial Bonus</p>
                {raceAbilityBonusInfo.fixed.length > 0 && (
                  <p style={{ margin: "0.3rem 0 0 0" }}>
                    {raceAbilityBonusInfo.fixed.map((a) => `+2 ${getAbilityLabel(a)}`).join(", ")}
                  </p>
                )}
                {raceAbilityBonusInfo.chooseOne.length > 0 && (
                  <label style={{ display: "block", marginTop: raceAbilityBonusInfo.fixed.length > 0 ? "0.35rem" : 0 }}>
                    <select
                      value={build.racialAbilityChoice || ""}
                      onChange={(e) =>
                        updateBuild({ ...build, racialAbilityChoice: (e.target.value || undefined) as CharacterBuild["racialAbilityChoice"] })
                      }
                      style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem" }}
                    >
                      <option value="">Select ability…</option>
                      {raceAbilityBonusInfo.chooseOne.map((ability) => (
                        <option key={ability} value={ability}>
                          {getAbilityLabel(ability)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {requiredAsiMilestonesUpTo(build.level).length > 0 && (
              <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "#f8f9ff" }}>
                <h4 style={{ margin: "0 0 0.45rem 0" }}>Level-up ability increases</h4>
                <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "#444", lineHeight: 1.45 }}>
                  At each listed level, pick two <strong>different</strong> abilities for +1 each (Player&apos;s Handbook). These stack with automatic +1 to all abilities at levels 11 and 21.
                </p>
                {requiredAsiMilestonesUpTo(build.level).map((m) => {
                  const pick = build.asiChoices?.[String(m)];
                  const otherAbilities = (a: Ability) => abilities.filter((x) => x !== a);
                  return (
                    <div key={m} style={{ marginBottom: "0.85rem" }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.88rem" }}>Level {m}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
                        <label style={{ fontSize: "0.82rem" }}>
                          First +1
                          <select
                            value={pick?.first || ""}
                            onChange={(e) => {
                              const first = e.target.value as Ability;
                              const second =
                                pick?.second && pick.second !== first ? pick.second : otherAbilities(first)[0];
                              updateBuild({
                                ...build,
                                asiChoices: { ...(build.asiChoices || {}), [String(m)]: { first, second } }
                              });
                            }}
                            style={{ display: "block", marginTop: "0.2rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                          >
                            <option value="">—</option>
                            {abilities.map((a) => (
                              <option key={`${m}-a-${a}`} value={a}>
                                {getAbilityLabel(a)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ fontSize: "0.82rem" }}>
                          Second +1
                          <select
                            value={pick?.second || ""}
                            onChange={(e) => {
                              const second = e.target.value as Ability;
                              const first =
                                pick?.first && pick.first !== second ? pick.first : otherAbilities(second)[0];
                              updateBuild({
                                ...build,
                                asiChoices: { ...(build.asiChoices || {}), [String(m)]: { first, second } }
                              });
                            }}
                            style={{ display: "block", marginTop: "0.2rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid #c4c5cc" }}
                          >
                            <option value="">—</option>
                            {abilities.map((a) => (
                              <option key={`${m}-b-${a}`} value={a}>
                                {getAbilityLabel(a)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {(build.level >= 11 || build.level >= 21) && (
              <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "#f8f9ff" }}>
                {build.level >= 11 && (
                  <div style={{ marginBottom: build.level >= 21 ? "0.55rem" : 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.88rem" }}>Paragon Tier</div>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "#444" }}>All ability scores increase by +1 automatically.</p>
                  </div>
                )}
                {build.level >= 21 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.88rem" }}>Epic Tier</div>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "#444" }}>All ability scores increase by +1 automatically.</p>
                  </div>
                )}
              </section>
            )}

            <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "#f8f9fc", borderColor: "#d7d9e1" }}>
              <div style={{ marginBottom: "0.55rem", fontSize: "0.82rem", fontWeight: 700, color: "#374151", letterSpacing: "0.01em" }}>
                Point-Buy Budget
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "0.75rem 1rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", width: "fit-content" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.03em" }}>Budget</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={build.pointBuyBudget ?? DEFAULT_POINT_BUY_BUDGET}
                    onChange={(e) => updateBuild({ ...build, pointBuyBudget: Number(e.target.value) })}
                    style={{
                      width: "4.4rem",
                      boxSizing: "border-box",
                      padding: "0.35rem 0.45rem",
                      textAlign: "center",
                      fontVariantNumeric: "tabular-nums",
                      borderRadius: "6px",
                      border: "1px solid #bcc1ce",
                      backgroundColor: "#fff",
                      fontWeight: 600
                    }}
                  />
                </label>
                <div style={{ flex: "1 1 14rem", display: "grid", gap: "0.35rem" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <strong style={{ color: "#374151" }}>Points spent:</strong>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pointBuy.total}</span>
                    <span style={{ color: "#6b7280" }}>/</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pointBuy.budget}</span>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      color: pointBuy.remaining < 0 ? "crimson" : pointBuy.remaining === 0 ? "#1a6b1a" : "#333",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem"
                    }}
                  >
                    <strong style={{ color: "#374151" }}>Remaining:</strong>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pointBuy.remaining}</span>
                  </p>
                  {pointBuy.invalidScores.length > 0 && (
                    <p style={{ color: "crimson", margin: "0.15rem 0 0 0", fontSize: "0.82rem", lineHeight: 1.35 }}>
                      Each score must be 8–18: {pointBuy.invalidScores.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div
              style={{
                ...ui.blockInset,
                marginTop: "0.35rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                alignItems: "start",
                backgroundColor: "#f8f9fc",
                borderColor: "#d7d9e1"
              }}
            >
              {(
                [
                  { title: "Physical", list: PHYSICAL_ABILITIES },
                  { title: "Mental", list: MENTAL_ABILITIES }
                ] as const
              ).map(({ title, list }) => (
                <div key={title} style={{ backgroundColor: "#ffffff", border: "1px solid #e3e5ec", borderRadius: "8px", padding: "0.5rem 0.65rem" }}>
                  <h4
                    style={{
                      margin: "0 0 0.45rem 0",
                      fontSize: "0.85rem",
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #e6e8ef",
                      paddingBottom: "0.3rem"
                    }}
                  >
                    {title}
                  </h4>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.86rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#6b7280", borderBottom: "1px solid #edf0f5" }}>
                        <th style={{ padding: "0.3rem 0.25rem 0.35rem 0", fontWeight: 700 }}>Ability</th>
                        <th style={{ padding: "0.3rem 0.25rem 0.35rem 0.25rem", fontWeight: 700, width: "4rem", textAlign: "center" }}>Base</th>
                        <th style={{ padding: "0.3rem 0", fontWeight: 700, width: "3.25rem", textAlign: "right" }}>Level</th>
                        <th style={{ padding: "0.3rem 0", fontWeight: 700, width: "3.25rem", textAlign: "right" }}>Racial</th>
                        <th style={{ padding: "0.3rem 0", fontWeight: 700, width: "3.5rem", textAlign: "right" }}>Final</th>
                        <th style={{ padding: "0.3rem 0", fontWeight: 700, width: "3.25rem", textAlign: "right" }}>Mod</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((ability) => {
                        const base = build.abilityScores[ability];
                        const postLevel = scoresAfterLevel[ability];
                        const final = effectiveAbilityScores[ability];
                        const mod = abilityModifier(final);
                        const levelDelta = postLevel - base;
                        const racialDelta = final - postLevel;
                        return (
                          <tr key={ability}>
                            <td style={{ padding: "0.45rem 0.25rem 0.45rem 0", verticalAlign: "middle" }}>
                              <span style={{ fontWeight: 600 }}>{ability}</span>
                              <span style={{ display: "block", fontSize: "0.78rem", color: "#666", fontWeight: 400 }}>{getAbilityLabel(ability)}</span>
                            </td>
                            <td style={{ padding: "0.35rem 0.25rem", verticalAlign: "middle", textAlign: "center", width: "3.75rem" }}>
                              <input
                                type="number"
                                min={8}
                                max={18}
                                value={base}
                                onChange={(e) =>
                                  updateBuild({
                                    ...build,
                                    abilityScores: { ...build.abilityScores, [ability]: Number(e.target.value) }
                                  })
                                }
                                style={{
                                  width: "3.25rem",
                                  maxWidth: "100%",
                                  boxSizing: "border-box",
                                  padding: "0.3rem 0.42rem",
                                  textAlign: "center",
                                  fontVariantNumeric: "tabular-nums",
                                  border: "1px solid #c8cedb",
                                  borderRadius: "6px",
                                  backgroundColor: "#fff",
                                  fontWeight: 600
                                }}
                                aria-label={`${getAbilityLabel(ability)} base score`}
                              />
                            </td>
                            <td style={{ padding: "0.35rem 0", verticalAlign: "middle", fontSize: "0.82rem", textAlign: "right" }}>
                              <span style={levelDelta === 0 ? { color: "#888" } : undefined}>
                                {levelDelta > 0 ? `+${levelDelta}` : levelDelta}
                              </span>
                            </td>
                            <td style={{ padding: "0.35rem 0", verticalAlign: "middle", fontSize: "0.82rem", textAlign: "right" }}>
                              <span style={racialDelta === 0 ? { color: "#888" } : undefined}>
                                {racialDelta > 0 ? `+${racialDelta}` : racialDelta}
                              </span>
                            </td>
                            <td style={{ padding: "0.35rem 0", verticalAlign: "middle", fontSize: "0.82rem", textAlign: "right" }}>
                              <span
                                title={`Final: ${final} (${formatAbilityMod(mod)} modifier)${
                                  levelDelta !== 0 ? `; level adjustment ${levelDelta > 0 ? "+" : ""}${levelDelta}` : ""
                                }${
                                  racialDelta !== 0 ? `; racial adjustment ${racialDelta > 0 ? "+" : ""}${racialDelta}` : ""
                                }`}
                              >
                                {final}
                              </span>
                            </td>
                            <td style={{ padding: "0.35rem 0", verticalAlign: "middle", fontWeight: 700, textAlign: "right" }}>
                              {formatAbilityMod(mod)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <details style={{ ...ui.blockInset, marginTop: "1rem", backgroundColor: "#ffffff" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>What do these abilities mean?</summary>
              <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {abilities.map((ability) => {
                  const lore = abilityLoreByCode.get(ability);
                  if (!lore) return null;
                  return (
                    <div key={ability}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>
                        {ability} — {getAbilityLabel(ability)}
                      </p>
                      <div style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "#444" }}>
                        <RulesRichText text={lore} paragraphStyle={{ fontSize: "0.82rem", color: "#444" }} listItemStyle={{ fontSize: "0.82rem", color: "#444" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {activeTab === "skills" && (
          <div>
            <h3>Skills</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", color: "#555", fontSize: "0.9rem", lineHeight: 1.45 }}>
              All skills are listed. You can only <strong>train</strong> skills from your class list (checkbox enabled). Other skills are shown for reference.
            </p>
            {!selectedClass && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.88rem", color: "#666" }}>Choose a class on the Class tab to enable training choices.</p>
            )}
            <div style={{ ...ui.blockInset, backgroundColor: "#fafafa" }}>
              {skillsSortedAll.map((skill) => {
                const checked = build.trainedSkillIds.includes(skill.id);
                const trainable = !!(selectedClass && selectedClassSkillNamesLower.has(skill.name.toLowerCase()));
                const autoGranted = autoGrantedSkillIdSet.has(skill.id);
                const canInteract = (trainable || checked) && !autoGranted;
                const skillBody = typeof skill.raw?.body === "string" ? skill.raw.body : "";
                const skillScore = calculateSkillScore(build, effectiveAbilityScores, skill.keyAbility, checked);
                return (
                  <div
                    key={skill.id}
                    style={{
                      marginBottom: "0.35rem",
                      opacity: trainable || checked ? 1 : 0.72
                    }}
                  >
                    <label style={{ display: "block", cursor: canInteract ? "pointer" : "default" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canInteract}
                        onChange={(e) => {
                          if (e.target.checked && !trainable) return;
                          const next = e.target.checked ? [...build.trainedSkillIds, skill.id] : build.trainedSkillIds.filter((id) => id !== skill.id);
                          updateBuild({ ...build, trainedSkillIds: next });
                        }}
                      />{" "}
                      <span style={{ fontWeight: trainable || checked ? 600 : 400 }}>
                        {skill.name} ({skill.keyAbility || "N/A"})
                      </span>
                      <span style={{ marginLeft: "0.4rem", fontSize: "0.84rem", color: "#333", fontWeight: 600 }}>
                        {skillScore === null ? "Score —" : `Score ${formatAbilityMod(skillScore)}`}
                      </span>
                      {autoGranted && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "#0f5132", fontWeight: 600 }}>
                          — auto trained
                        </span>
                      )}
                      {!trainable && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "#888", fontWeight: 400 }}>
                          {selectedClass ? "— not on class list" : ""}
                        </span>
                      )}
                      {checked && !trainable && selectedClass && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "crimson", fontWeight: 600 }}>
                          (clear — not a class skill)
                        </span>
                      )}
                    </label>
                    {skillBody && (
                      <details open style={{ marginLeft: "1.25rem", marginTop: "0.15rem" }}>
                        <summary style={{ fontSize: "0.85rem" }}>Description</summary>
                        <div style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0", color: "#444" }}>
                          <RulesRichText text={skillBody} paragraphStyle={{ fontSize: "0.8rem", color: "#444" }} listItemStyle={{ fontSize: "0.8rem", color: "#444" }} />
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "feats" && (
          <div>
            <h3>Feat Selection</h3>
            <p style={{ margin: "0.25rem 0 0.5rem 0", fontSize: "0.85rem", color: "#555" }}>
              <strong>
                {build.featIds.length} / {expectedFeatCount}
              </strong>{" "}
              feat slot{expectedFeatCount === 1 ? "" : "s"} at level {build.level}
              {isHumanRace(selectedRace?.name) ? " (includes human bonus feat)." : "."}{" "}
              {showInvalidFeats ? (
                <>Showing all {featOptions.length} feat{featOptions.length === 1 ? "" : "s"} ({allLegalFeats.length} legal).</>
              ) : (
                <>{allLegalFeats.length} legal feat{allLegalFeats.length === 1 ? "" : "s"} for this build.</>
              )}{" "}
              Search by name, source, tier, category, tags, prerequisites, or rules text. Click a row to add or remove a feat.
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.88rem", marginBottom: "0.5rem", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={showInvalidFeats}
                onChange={(e) => setShowInvalidFeats(e.target.checked)}
              />
              Show invalid feats (not eligible; cannot be selected)
            </label>
            <label style={{ display: "block", fontSize: "0.88rem", marginBottom: "0.45rem" }}>
              Search feats
              <input
                type="search"
                value={featSearch}
                onChange={(e) => setFeatSearch(e.target.value)}
                placeholder="Filter by name, source, category, tags, prereqs…"
                style={{
                  width: "100%",
                  maxWidth: "28rem",
                  marginTop: "0.2rem",
                  padding: "0.4rem 0.5rem",
                  border: "1px solid #c4c5cc",
                  borderRadius: "6px",
                  boxSizing: "border-box"
                }}
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.55rem" }}>
              <label style={{ fontSize: "0.82rem", color: "#444" }}>
                Tier
                <select
                  value={featTierFilter}
                  onChange={(e) => setFeatTierFilter(e.target.value as "all" | "HEROIC" | "PARAGON" | "EPIC")}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "8.5rem", padding: "0.35rem", border: "1px solid #c4c5cc", borderRadius: "6px" }}
                >
                  <option value="all">All tiers</option>
                  <option value="HEROIC">Heroic</option>
                  <option value="PARAGON">Paragon</option>
                  <option value="EPIC">Epic</option>
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "#444" }}>
                Category
                <select
                  value={featCategoryFilter}
                  onChange={(e) => setFeatCategoryFilter(e.target.value)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "10rem", padding: "0.35rem", border: "1px solid #c4c5cc", borderRadius: "6px" }}
                >
                  <option value="all">All categories</option>
                  {featCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "#444" }}>
                Source
                <select
                  value={featSourceFilter}
                  onChange={(e) => setFeatSourceFilter(e.target.value)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "11rem", padding: "0.35rem", border: "1px solid #c4c5cc", borderRadius: "6px" }}
                >
                  <option value="all">All sources</option>
                  {featSourceOptions.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "#444" }}>
                Sort
                <select
                  value={featSortMode}
                  onChange={(e) => setFeatSortMode(e.target.value as FeatSortMode)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "11rem", padding: "0.35rem", border: "1px solid #c4c5cc", borderRadius: "6px" }}
                >
                  <option value="tier-alpha">Tier, then name</option>
                  <option value="alpha">Name (A-Z)</option>
                  <option value="source-alpha">Source, then name</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.45rem" }}>
              <button type="button" onClick={() => updateBuild({ ...build, featIds: [] })} style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #c4c5cc", background: "#fff", cursor: "pointer" }}>
                Clear all feats
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeatSearch("");
                  setFeatTierFilter("all");
                  setFeatCategoryFilter("all");
                  setFeatSourceFilter("all");
                  setFeatSortMode("tier-alpha");
                }}
                style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #c4c5cc", background: "#fff", cursor: "pointer" }}
              >
                Reset feat filters
              </button>
            </div>
            <div style={{ ...ui.blockInset, maxHeight: "280px", overflow: "auto", backgroundColor: "#fafafa", padding: "0.35rem" }}>
              {filteredFeatRows.length === 0 ? (
                <p style={{ margin: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                  {allLegalFeats.length === 0 && !showInvalidFeats
                    ? "No feats are legal for this build yet. Check prerequisites (ability scores, race, class, skills), or turn on “Show invalid feats” to browse others."
                    : "No feats match this search. Clear the filter or try different keywords."}
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredFeatRows.map((opt) => {
                    const selected = build.featIds.includes(opt.item.id);
                    const invalid = !opt.legal;
                    const atCap = !selected && build.featIds.length >= expectedFeatCount;
                    const featCategory = getFeatFacetCategory(opt.item);
                    const featTier = String(opt.item.tier || "").trim();
                    return (
                      <li key={opt.item.id} style={{ marginBottom: "0.2rem" }}>
                        <button
                          type="button"
                          disabled={invalid || atCap}
                          onClick={() => {
                            if (invalid) return;
                            if (selected) {
                              updateBuild({ ...build, featIds: build.featIds.filter((id) => id !== opt.item.id) });
                            } else if (!atCap) {
                              updateBuild({ ...build, featIds: [...build.featIds, opt.item.id] });
                            }
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "0.45rem 0.55rem",
                            borderRadius: "6px",
                            border: selected ? "1px solid #9b9ca8" : "1px solid transparent",
                            background: invalid ? "#ececee" : selected ? "#d8d9df" : "#fff",
                            cursor: invalid || atCap ? "not-allowed" : "pointer",
                            fontSize: "0.88rem",
                            opacity: invalid ? 0.92 : 1
                          }}
                        >
                          <span style={{ fontWeight: selected ? 600 : 500 }}>
                            {opt.item.name}
                            {invalid && (
                              <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "#9a3412" }}>Invalid</span>
                            )}
                          </span>
                          <span style={{ display: "block", marginTop: "0.2rem" }}>
                            {featTier && (
                              <span style={{ display: "inline-block", marginRight: "0.3rem", padding: "0.08rem 0.35rem", borderRadius: "999px", fontSize: "0.7rem", background: "#ebeef5", color: "#334155", fontWeight: 600 }}>
                                {featTier}
                              </span>
                            )}
                            <span style={{ display: "inline-block", marginRight: "0.3rem", padding: "0.08rem 0.35rem", borderRadius: "999px", fontSize: "0.7rem", background: "#f0f4ff", color: "#1e3a8a", fontWeight: 600 }}>
                              {featCategory}
                            </span>
                          </span>
                          {opt.item.source && (
                            <span style={{ display: "block", fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{opt.item.source}</span>
                          )}
                          {invalid && opt.reasons.length > 0 && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "#92400e", marginTop: "0.15rem", fontWeight: 400 }}>
                              {opt.reasons.join("; ")}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selectedFeatLore && (
              <div style={{ ...ui.blockInset, marginTop: "0.75rem", backgroundColor: "#fafafa" }}>
                {selectedFeatLore.flavor && <p style={{ margin: 0, fontStyle: "italic", color: "#333" }}>{selectedFeatLore.flavor}</p>}
                {selectedFeatLore.shortLine && (
                  <p style={{ margin: selectedFeatLore.flavor ? "0.5rem 0 0 0" : 0 }}>{selectedFeatLore.shortLine}</p>
                )}
                {selectedFeatLore.body && (
                  <details open style={{ marginTop: "0.5rem" }}>
                    <summary>Full text</summary>
                    <div style={{ margin: "0.4rem 0 0 0", fontSize: "0.9rem" }}>
                      <RulesRichText text={selectedFeatLore.body} paragraphStyle={{ fontSize: "0.9rem" }} listItemStyle={{ fontSize: "0.9rem" }} />
                    </div>
                  </details>
                )}
              </div>
            )}
            <div style={{ ...ui.blockInset, marginTop: "0.75rem", backgroundColor: "#fafafa" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151", marginBottom: "0.3rem" }}>Selected Feats</div>
              {selectedFeats.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#6b7280" }}>No feats selected yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {selectedFeats.map((f) => {
                    const raw = f.raw as Record<string, unknown>;
                    const specific = (raw.specific as Record<string, unknown> | undefined) || {};
                    const shortDesc =
                      (typeof f.shortDescription === "string" && f.shortDescription.trim()) ||
                      (typeof specific["Short Description"] === "string" && String(specific["Short Description"]).trim()) ||
                      "";
                    const bodyText = typeof raw.body === "string" ? raw.body.trim() : "";
                    const summary = shortDesc || (bodyText ? bodyText.slice(0, 180) + (bodyText.length > 180 ? "..." : "") : "");
                    const tier = String(f.tier || "").trim();
                    return (
                      <article
                        key={f.id}
                        style={{
                          border: "1px solid #d7dbe5",
                          borderRadius: "8px",
                          backgroundColor: "#fff",
                          padding: "0.45rem 0.55rem"
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#1f2937" }}>{f.name}</div>
                        <div style={{ marginTop: "0.18rem", display: "flex", flexWrap: "wrap", gap: "0.3rem 0.45rem", alignItems: "center" }}>
                          {f.source ? (
                            <span style={{ fontSize: "0.74rem", color: "#4b5563", backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "999px", padding: "0.06rem 0.38rem" }}>
                              {f.source}
                            </span>
                          ) : null}
                          {tier ? (
                            <span style={{ fontSize: "0.72rem", color: "#1e3a8a", backgroundColor: "#eef2ff", border: "1px solid #dbe4ff", borderRadius: "999px", padding: "0.06rem 0.38rem", fontWeight: 600 }}>
                              {tier}
                            </span>
                          ) : null}
                        </div>
                        {summary && (
                          <div style={{ marginTop: "0.28rem", color: "#4b5563", fontSize: "0.79rem", lineHeight: 1.4 }}>
                            {summary}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "powers" && (
          <div>
            <h3>Power Selection</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", fontSize: "0.85rem", color: "#555", lineHeight: 1.45 }}>
              Each <strong>slot</strong> is a separate choice. The list for a slot only includes powers whose <strong>printed level</strong> is at most that slot&apos;s level (e.g. 3rd-level encounter → level 3 or lower encounter powers). Search filters the lists. Paragon path powers are not included in this MVP.
            </p>
            {legality.powerSlotRules && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.82rem", color: "#444" }}>
                <strong>Required for level {build.level}:</strong> {legality.powerSlotRules.atWill} at-will attack,{" "}
                {legality.powerSlotRules.encounter} encounter attack, {legality.powerSlotRules.daily} daily attack,{" "}
                {legality.powerSlotRules.utility} utility.
              </p>
            )}
            {(racePowerGroups.some((g) => g.powerIds.length > 0) ||
              classAutoGrantedPowers.length > 0 ||
              featAssociatedPowers.length > 0) && (
              <section style={{ marginBottom: "1.1rem", padding: "0.65rem 0.75rem", backgroundColor: "#f4f6fb", borderRadius: "8px", border: "1px solid #d8dce8" }}>
                {racePowerGroups.some((g) => g.powerIds.length > 0) && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div>
                      {racePowerGroups
                        .filter((g) => g.powerIds.length > 0)
                        .map((g) => (
                          <div key={g.traitId} style={{ marginBottom: "0.35rem" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "#333" }}>{g.traitName}</span>
                            {g.choiceOnly ? (
                              <span style={{ color: "#6b5a2a", fontSize: "0.78rem" }}> — choose one:</span>
                            ) : null}
                            <div style={{ marginTop: "0.2rem" }}>
                              {g.powerIds.map((pid) => {
                                const p = index.powers.find((x) => x.id === pid);
                                return p ? renderPowerCard(p, `race-${g.traitId}-${p.id}`) : <div key={pid}>{pid}</div>;
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {classAutoGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#333", marginBottom: "0.25rem" }}>Class (automatic)</div>
                    <div>
                      {classAutoGrantedPowers.map((p) => renderPowerCard(p, `class-${p.id}`))}
                    </div>
                  </div>
                )}
                {featAssociatedPowers.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#333", marginBottom: "0.25rem" }}>Feats you selected</div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "#333" }}>
                      {featAssociatedPowers.map(({ feat, powers }) => (
                        <li key={feat.id} style={{ marginBottom: "0.45rem" }}>
                          <span style={{ fontWeight: 600 }}>{feat.name}</span>
                          <div style={{ marginTop: "0.2rem" }}>
                            {powers.map((p) => renderPowerCard(p, `${feat.id}-${p.id}`))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
            {!selectedClass ? (
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>Choose a class on the Class tab to assign powers.</p>
            ) : (
              <>
                <label style={{ display: "block", fontSize: "0.88rem", marginBottom: "0.65rem" }}>
                  Search powers
                  <input
                    type="search"
                    value={powerSearch}
                    onChange={(e) => setPowerSearch(e.target.value)}
                    placeholder="Filter by name, keywords, usage…"
                    style={{
                      width: "100%",
                      maxWidth: "28rem",
                      marginTop: "0.2rem",
                      padding: "0.4rem 0.5rem",
                      border: "1px solid #c4c5cc",
                      borderRadius: "6px",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
                {powerSlotDefs.map((def, idx) => {
                  const showBucketHeader = idx === 0 || powerSlotDefs[idx - 1].bucket !== def.bucket;
                  const slotsMap = build.classPowerSlots || {};
                  const taken = new Set(
                    Object.entries(slotsMap)
                      .filter(([k, v]) => k !== def.key && v)
                      .map(([, v]) => v)
                  );
                  const pool: Power[] =
                    def.bucket === "utility"
                      ? classUtilityPowers
                      : classAttackPowers.filter((p) => attackPowerBucketFromUsage(p.usage) === def.bucket);
                  const poolForSlot = pool.filter((p) => powerPrintedLevelEligibleForSlot(p, def));
                  const value = slotsMap[def.key] || "";
                  const selPow = value ? index.powers.find((p) => p.id === value) : undefined;
                  let candidates = poolForSlot.filter((p) => !taken.has(p.id) || p.id === slotsMap[def.key]);
                  if (value && selPow && !candidates.some((p) => p.id === value)) {
                    candidates = [selPow, ...candidates];
                  }
                  const filtered = [...filterPowersByQuery(candidates, powerSearch)].sort((a, b) => {
                    const la = a.level ?? 0;
                    const lb = b.level ?? 0;
                    if (lb !== la) return lb - la;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                  });
                  return (
                    <section key={def.key} style={{ marginBottom: "1rem" }}>
                      {showBucketHeader && (
                        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#333", borderBottom: "1px solid #d5d6dc", paddingBottom: "0.25rem" }}>
                          {slotBucketSectionTitle(def.bucket)}
                        </h4>
                      )}
                      <div style={{ ...ui.blockInset, backgroundColor: "#fafafa", padding: "0.65rem 0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "#333" }}>
                          {def.label}
                        </label>
                        {poolForSlot.length === 0 ? (
                          <p style={{ margin: 0, color: "#666", fontSize: "0.86rem" }}>
                            No powers of this type at printed level {def.gainLevel} or below for your level yet.
                          </p>
                        ) : (
                          <select
                            value={value}
                            onChange={(e) => commitClassPowerSlot(def.key, e.target.value)}
                            style={{
                              width: "100%",
                              maxWidth: "28rem",
                              padding: "0.4rem",
                              borderRadius: "6px",
                              border: "1px solid #c4c5cc",
                              boxSizing: "border-box"
                            }}
                          >
                            <option value="">— Choose power —</option>
                            {filtered.map((power) => {
                              const ps = (power.raw?.specific as Record<string, unknown> | undefined) || {};
                              const pl = power.level ?? 0;
                              return (
                                <option key={power.id} value={power.id}>
                                  {power.name} (Lv {pl}, {power.usage || "?"}) — {String(ps["Keywords"] || "")}
                                </option>
                              );
                            })}
                          </select>
                        )}
                        {poolForSlot.length > 0 && filtered.length === 0 && (
                          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.78rem", color: "#92400e" }}>
                            No powers match this filter; clear search to see options for this slot.
                          </p>
                        )}
                        {selPow && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151" }}>Selected power card</div>
                            {renderPowerCard(selPow, `slot-${def.key}-${selPow.id}`)}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === "paths" && (
          <div>
            <h3>Theme, paragon path, and epic destiny</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "#555", fontSize: "0.88rem", lineHeight: 1.45 }}>
              Themes are optional packages with prerequisites. Paragon paths require <strong>level 11+</strong>; epic destinies require{" "}
              <strong>level 21+</strong>. Dropping level clears a path or destiny that is no longer legal.
            </p>

            <section style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.35rem 0" }}>Theme</h4>
              <label style={{ display: "block", fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Search themes
                <input
                  type="search"
                  value={themeSearch}
                  onChange={(e) => setThemeSearch(e.target.value)}
                  placeholder="Name, source…"
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    marginTop: "0.2rem",
                    padding: "0.4rem 0.5rem",
                    border: "1px solid #c4c5cc",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, themeId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #c4c5cc", background: "#fff", cursor: "pointer" }}
                >
                  Clear theme
                </button>
                {build.themeId && selectedTheme && (
                  <span style={{ fontSize: "0.85rem", color: "#444" }}>
                    Selected: <strong>{selectedTheme.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockInset, maxHeight: "220px", overflow: "auto", backgroundColor: "#fafafa", padding: "0.35rem" }}>
                {filteredThemes.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "#666", fontSize: "0.9rem" }}>No themes match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredThemes.map((t) => {
                      const selected = build.themeId === t.id;
                      const { legal, reasons } = evalOptionWithLevel(t.prereqTokens, 0);
                      return (
                        <li key={t.id} style={{ marginBottom: "0.2rem" }}>
                          <button
                            type="button"
                            disabled={!legal}
                            onClick={() => {
                              if (legal) updateBuild({ ...build, themeId: t.id });
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.45rem 0.55rem",
                              borderRadius: "6px",
                              border: selected ? "1px solid #9b9ca8" : "1px solid transparent",
                              background: !legal ? "#ececee" : selected ? "#d8d9df" : "#fff",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {t.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "#9a3412" }}>Invalid</span>
                              )}
                            </span>
                            {t.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{t.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#92400e", marginTop: "0.15rem", fontWeight: 400 }}>
                                {reasons.join("; ")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {selectedTheme?.raw?.flavor && typeof selectedTheme.raw.flavor === "string" && (
                <p style={{ ...ui.blockInset, marginTop: "0.65rem", fontStyle: "italic", fontSize: "0.9rem" }}>{selectedTheme.raw.flavor}</p>
              )}
              {selectedTheme?.raw?.body && typeof selectedTheme.raw.body === "string" && (
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary>Theme details</summary>
                  <div style={{ marginTop: "0.4rem" }}>
                    <RulesRichText text={String(selectedTheme.raw.body)} paragraphStyle={{ fontSize: "0.9rem" }} listItemStyle={{ fontSize: "0.9rem" }} />
                  </div>
                </details>
              )}
            </section>

            <section style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.35rem 0" }}>Paragon path</h4>
              {build.level < 11 && (
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#7c2d12" }}>Set level to 11 or higher to choose a paragon path.</p>
              )}
              <label style={{ display: "block", fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Search paragon paths
                <input
                  type="search"
                  value={paragonSearch}
                  onChange={(e) => setParagonSearch(e.target.value)}
                  placeholder="Name, source…"
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    marginTop: "0.2rem",
                    padding: "0.4rem 0.5rem",
                    border: "1px solid #c4c5cc",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, paragonPathId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #c4c5cc", background: "#fff", cursor: "pointer" }}
                >
                  Clear paragon path
                </button>
                {build.paragonPathId && selectedParagonPath && (
                  <span style={{ fontSize: "0.85rem", color: "#444" }}>
                    Selected: <strong>{selectedParagonPath.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockInset, maxHeight: "240px", overflow: "auto", backgroundColor: "#fafafa", padding: "0.35rem" }}>
                {filteredParagonPaths.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "#666", fontSize: "0.9rem" }}>No paragon paths match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredParagonPaths.map((p) => {
                      const selected = build.paragonPathId === p.id;
                      const { legal, reasons } = evalOptionWithLevel(p.prereqTokens, 11);
                      return (
                        <li key={p.id} style={{ marginBottom: "0.2rem" }}>
                          <button
                            type="button"
                            disabled={!legal}
                            onClick={() => {
                              if (legal) updateBuild({ ...build, paragonPathId: p.id });
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.45rem 0.55rem",
                              borderRadius: "6px",
                              border: selected ? "1px solid #9b9ca8" : "1px solid transparent",
                              background: !legal ? "#ececee" : selected ? "#d8d9df" : "#fff",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {p.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "#9a3412" }}>Invalid</span>
                              )}
                            </span>
                            {p.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{p.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#92400e", marginTop: "0.15rem", fontWeight: 400 }}>
                                {reasons.join("; ")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {selectedParagonPath?.prereqsRaw && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.82rem", color: "#555" }}>
                  <strong>Prerequisites:</strong> {selectedParagonPath.prereqsRaw}
                </p>
              )}
              {selectedParagonPath?.raw?.body && typeof selectedParagonPath.raw.body === "string" && (
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary>Paragon path details</summary>
                  <div style={{ marginTop: "0.4rem" }}>
                    <RulesRichText
                      text={String(selectedParagonPath.raw.body)}
                      paragraphStyle={{ fontSize: "0.9rem" }}
                      listItemStyle={{ fontSize: "0.9rem" }}
                    />
                  </div>
                </details>
              )}
            </section>

            <section>
              <h4 style={{ margin: "0 0 0.35rem 0" }}>Epic destiny</h4>
              {build.level < 21 && (
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#7c2d12" }}>Set level to 21 or higher to choose an epic destiny.</p>
              )}
              <label style={{ display: "block", fontSize: "0.88rem", marginBottom: "0.4rem" }}>
                Search epic destinies
                <input
                  type="search"
                  value={epicSearch}
                  onChange={(e) => setEpicSearch(e.target.value)}
                  placeholder="Name, source…"
                  style={{
                    width: "100%",
                    maxWidth: "28rem",
                    marginTop: "0.2rem",
                    padding: "0.4rem 0.5rem",
                    border: "1px solid #c4c5cc",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, epicDestinyId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #c4c5cc", background: "#fff", cursor: "pointer" }}
                >
                  Clear epic destiny
                </button>
                {build.epicDestinyId && selectedEpicDestiny && (
                  <span style={{ fontSize: "0.85rem", color: "#444" }}>
                    Selected: <strong>{selectedEpicDestiny.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockInset, maxHeight: "240px", overflow: "auto", backgroundColor: "#fafafa", padding: "0.35rem" }}>
                {filteredEpicDestinies.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "#666", fontSize: "0.9rem" }}>No epic destinies match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredEpicDestinies.map((d) => {
                      const selected = build.epicDestinyId === d.id;
                      const { legal, reasons } = evalOptionWithLevel(d.prereqTokens, 21);
                      return (
                        <li key={d.id} style={{ marginBottom: "0.2rem" }}>
                          <button
                            type="button"
                            disabled={!legal}
                            onClick={() => {
                              if (legal) updateBuild({ ...build, epicDestinyId: d.id });
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.45rem 0.55rem",
                              borderRadius: "6px",
                              border: selected ? "1px solid #9b9ca8" : "1px solid transparent",
                              background: !legal ? "#ececee" : selected ? "#d8d9df" : "#fff",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {d.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "#9a3412" }}>Invalid</span>
                              )}
                            </span>
                            {d.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{d.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "#92400e", marginTop: "0.15rem", fontWeight: 400 }}>
                                {reasons.join("; ")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {selectedEpicDestiny?.prereqsRaw && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.82rem", color: "#555" }}>
                  <strong>Prerequisites:</strong> {selectedEpicDestiny.prereqsRaw}
                </p>
              )}
              {selectedEpicDestiny?.raw?.body && typeof selectedEpicDestiny.raw.body === "string" && (
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary>Epic destiny details</summary>
                  <div style={{ marginTop: "0.4rem" }}>
                    <RulesRichText
                      text={String(selectedEpicDestiny.raw.body)}
                      paragraphStyle={{ fontSize: "0.9rem" }}
                      listItemStyle={{ fontSize: "0.9rem" }}
                    />
                  </div>
                </details>
              )}
            </section>
          </div>
        )}

        {activeTab === "equipment" && (
          <div>
            <h3>Equipment</h3>
            <div style={{ ...ui.blockInset, marginTop: "0.35rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", backgroundColor: "#fafafa" }}>
              <label>
                Armor
                <select value={build.armorId || ""} onChange={(e) => updateBuild({ ...build, armorId: e.target.value || undefined })} style={{ width: "100%" }}>
                  <option value="">None</option>
                  {armorOptions.map((a) => <option key={a.id} value={a.id}>{a.name} (+{a.armorBonus || 0} AC)</option>)}
                </select>
              </label>
              <label>
                Shield
                <select value={build.shieldId || ""} onChange={(e) => updateBuild({ ...build, shieldId: e.target.value || undefined })} style={{ width: "100%" }}>
                  <option value="">None</option>
                  {shieldOptions.map((a) => <option key={a.id} value={a.id}>{a.name} (+{a.armorBonus || 0} AC)</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button onClick={() => exportBuild(build)}>Export Character JSON</button>
            <button onClick={() => updateBuild(defaultBuild)}>Reset</button>
            <label>
              Import JSON
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importBuildFromFile(file, updateBuild);
                }}
              />
            </label>
          </div>
        )}
        </div>
      </div>

      <div style={ui.sidebarColumn}>
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1.1rem", color: "#1a1a1e" }}>Live Character Sheet</h3>
        <div style={{ ...ui.blockInset, backgroundColor: "#f7f8fb", borderColor: "#cfd3dc", display: "grid", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "#4b5563", textTransform: "uppercase" }}>
              Character
            </p>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Race:</strong> {selectedRace?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Class:</strong> {selectedClass?.name || "None"}</p>
              {build.classSelections?.buildOption && (
                <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Class Build:</strong> {build.classSelections.buildOption}</p>
              )}
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Level:</strong> {build.level}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Theme:</strong> {selectedTheme?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Paragon Path:</strong> {selectedParagonPath?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Epic Destiny:</strong> {selectedEpicDestiny?.name || "None"}</p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #dde1ea", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "#4b5563", textTransform: "uppercase" }}>
              Equipment
            </p>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Armor:</strong> {selectedArmor?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Shield:</strong> {selectedShield?.name || "None"}</p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #dde1ea", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "#4b5563", textTransform: "uppercase" }}>
              Combat Stats
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>HP:</strong> {derived.maxHp}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Speed:</strong> {derived.speed}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Healing Surges:</strong> {derived.healingSurgesPerDay}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Surge Value:</strong> {derived.surgeValue}</p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #dde1ea", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "#4b5563", textTransform: "uppercase" }}>
              Defenses
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>AC:</strong> {derived.defenses.ac}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Fortitude:</strong> {derived.defenses.fortitude}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Reflex:</strong> {derived.defenses.reflex}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Will:</strong> {derived.defenses.will}</p>
            </div>
          </div>
        </div>
        <div style={ui.blockSheetSection}>
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", color: "#25252c" }}>Validation Notes</h4>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {featOptions
            .filter((f) => !f.legal && build.featIds.includes(f.item.id))
            .flatMap((f) => f.reasons.map((r) => `${f.item.name}: ${r}`))
            .map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => setActiveTab(mapErrorToTab(r))}
                  style={{ border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", padding: 0, color: "#374151" }}
                >
                  {r}
                </button>
              </li>
            ))}
          {legality.errors.map((e) => (
            <li key={e}>
              <button
                type="button"
                onClick={() => setActiveTab(mapErrorToTab(e))}
                style={{ border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", padding: 0, color: "#374151" }}
              >
                {e}
              </button>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </div>
  );
}

