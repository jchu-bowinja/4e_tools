import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Ability,
  AsiChoices,
  CharacterBuild,
  EquippedSlotKey,
  EquipmentSlot,
  Feat,
  HybridClassDef,
  ClassFeature,
  Power,
  RacialTrait,
  RulesIndex
} from "../../rules/models";
import { defaultBuild } from "./defaultBuild";
import {
  deleteSavedCharacterById,
  loadBuild,
  loadSavedCharacters,
  saveBuild,
  saveBuildToSavedCharacters,
  type SavedCharacterEntry
} from "./storage";
import { formatSavedCharacterClassLevel } from "./savedCharacterDisplay";
import { mergeHybridProficiencyLines } from "../../rules/hybridDerivedStats";
import {
  buildHybridPowerSlotDefinitions,
  hybridPowerPoolUnion,
  inferHybridClassPowerSlotsFromPowerIds,
  powerAllowedForHybridSlot,
  reconcileHybridClassPowerSlotsForBuild
} from "../../rules/hybridPowerSlots";
import { computeBuilderLikeDerivedStats } from "../../rules/derivedStatsFromBuild";
import { resolveFeatOptions } from "../../rules/optionResolver";
import { applyAsiBonusesToScores, requiredAsiMilestonesUpTo, totalFeatSlots } from "../../rules/advancement";
import {
  attackPowerBucketFromUsage,
  buildClassPowerSlotDefinitions,
  inferClassPowerSlotsFromPowerIds,
  orderedPowerIdsFromSlots,
  powerPrintedLevelEligibleForSlot,
  reconcileClassPowerSlotsForBuild,
  slotBucketSectionTitle,
  upcomingClassPowerSlotMilestones
} from "../../rules/classPowerSlots";
import { getClassPowersForLevelRange, validateCharacterBuild } from "../../rules/characterValidator";
import { getPowersForOwnerId } from "../../rules/classPowersQuery";
import {
  dilettanteRacePowerGroupsForBuild,
  getDilettanteCandidatePowersForBuild,
  resolveDilettanteDisplayPower
} from "../../rules/dilettantePower";
import { resolveBaseAugmentablePowerId } from "../../rules/psionicPowerAugments";
import {
  autoGrantedClassPowers,
  bonusClassAtWillSlotFromRaceBuild,
  findHumanPowerSelectionBundleSlot,
  ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION,
  collectFeatGrantedPowersForBuild,
  collectFeatModifiedPowersForBuild,
  racePowerGroupsForRace,
  racePowerSelectSelectionKey
} from "../../rules/grantedPowersQuery";
import { collectFeatModificationsByPowerId } from "../../rules/featPowerModifications";
import { collectFeatClassFeatureModificationsForBuild } from "../../rules/featClassFeatureModifications";
import {
  collectMulticlassSlotSwapRows,
  multiclassPowersForSlotSwap,
  toggleMulticlassSlotSwap,
  updateMulticlassSlotSwapReplacement,
  pruneMulticlassSlotSwaps
} from "../../rules/featMulticlassSlotSwap";
import {
  collectFeatPowerReplaceRows,
  disableFeatPowerReplace,
  enableFeatPowerReplace,
  isSlotUsedByAnotherFeatSwap,
  pruneFeatPowerReplacements
} from "../../rules/featPowerReplace";
import { collectCharacterPowerIdsForSelections } from "../../rules/powerSelections";
import { hybridBaseClassNames } from "../../rules/prereqEvaluator";
import { buildPrereqCharacterContext } from "../../rules/prereqContext";
import { evaluateSupportOptionLegality } from "../../rules/supportOptionLegality";
import {
  applyRacialBonuses,
  formatRaceAbilityBonusSummary,
  getAbilityLabel,
  raceDefersAbilityBonusToSubrace,
  resolveRaceAbilityBonusInfo
} from "../../rules/abilityScores";
import {
  countsAsRaceOptions,
  getRacialTraitRuleSelectSlotsForRaceTab,
  resolveRacialFeatSlotCountForBuild,
  resolveRacialSkillTrainingSlotCountForBuild
} from "../../rules/racialTraitRuleSelects";
import { getRaceSecondarySelectSlots, selectableStartingLanguages } from "../../rules/raceRuleSelects";
import { parseRacialTraitIdsFromRace } from "../../rules/racialTraits";
import {
  getRaceExtraTraitIds,
  getRaceTraitBundleSlots,
  resolveDisplayedRacialTraitsForRace
} from "../../rules/raceSubraces";
import {
  filterVisibleClassFeatureChoiceGroups,
  formatClassPowerChoiceSelection,
  getClassFeatureChoiceGroups,
  parseClassPowerChoiceSelection,
  pruneHiddenClassFeatureSelections
} from "../../rules/classFeatureChoices";
import { getClassTraitRows, getHybridClassTraitRows, type TraitDisplayRow } from "../../rules/supportTraits";
import { autoGrantedTrainedSkillIds, effectiveTrainedSkillIdSet } from "../../rules/grantedSkillsQuery";
import { computeSkillSheetRows } from "../../rules/skillCalculator";
import {
  BUILDER_ABILITY_SCORE_COLUMNS,
  DEFENSE_SCORE_COLUMNS,
  MOTION_INITIATIVE_COLUMNS
} from "../../rules/statScoreBreakdown";
import { SKILL_BREAKDOWN_COLUMNS } from "../../ui/scoreBreakdownColumns";
import {
  formatSkillBreakdownComponent,
  formatSkillBreakdownTotal,
  skillRowMap,
  skillRowsToBreakdown
} from "../../ui/scoreBreakdownSkill";
import { SkillModifierNameContent } from "../../ui/scoreBreakdownSkillName";
import { ScoreBreakdownTable, type ScoreBreakdownRowDef } from "../../ui/ScoreBreakdownTable";
import { scoreComponentCellStyle } from "../../ui/scoreTableCells";
import {
  collectCountsAsClassNames,
  collectCountsAsFeatureNames,
  collectInternalGrantKeys,
  collectMulticlassEntryFeatIds,
  formatInternalGrantKey
} from "../../rules/featGrantFlags";
import { multiclassFeatIds } from "../../rules/multiclassDetection";
import {
  canChooseParagonMulticlassing,
  filterParagonMulticlassAtWillOptions,
  filterParagonMulticlassDailyOptions,
  filterParagonMulticlassEncounterOptions,
  multiclassEntryClassId,
  paragonMulticlassAttackPowers,
  paragonMulticlassUtilityPowers,
  disableParagonAtWillSwap,
  isSlotUsedByParagonAtWillSwap,
  paragonAtWillSlotDefs,
  pruneParagonMulticlassing,
  resolveParagonMulticlassPowers,
  setParagonAtWillSwap
} from "../../rules/paragonMulticlassing";
import {
  characterHasKiFocusUser,
  characterHasPsionicSecondClass
} from "../../rules/featGrantFlags";
import { pruneStalePowerSelections } from "../../rules/powerSelections";
import {
  hybridHasPsionicComponent,
  hybridPsionicAugmentationBreakpointsForLevel,
  powerPointsForPrintedLevel,
  paragonMulticlassPrimaryAtWillSlotPenalty,
  psionicAugmentationPoolLabel,
  pruneHybridPsionicAugmentationChoices,
  showPsionicPowerPointSummary,
  summarizePsionicPowerPointAdjustments
} from "../../rules/psionicPowerPoints";
import type { HybridPsionicAugmentationChoice } from "../../rules/models";
import {
  collectCharacterProficiencyDisplayRows,
  collectCharacterProficiencyGrants
} from "../../rules/featProficiencies";
import {
  normalizeCharacterBuild,
  normalizeCharacterEquipment,
  resolveEffectiveEquipmentIds
} from "../../rules/equipment";
import { computeMagicItemCombatBonuses } from "../../rules/magicItemEquipment";
import { equipmentSlotGoldCost } from "../../rules/equipmentItemPrice";
import {
  addAcquiredEquipmentToBuild,
  characterBuildInventoryItems,
  equipInventoryItemOnBuild,
  unequipInventoryItemOnBuild
} from "../characterSheet/sheetEquipment";
import { CharacterEquippedSlotsPanel } from "../characterSheet/CharacterEquippedSlotsPanel";
import { CharacterInventoryList } from "../characterSheet/CharacterInventoryList";
import type { EquipmentPriceSlot } from "../../rules/equipmentItemPrice";
import { summarizeImplementAttack, summarizeMainWeaponAttack } from "../../rules/weaponAttack";
import { BuilderSidebarItemsPanel } from "./BuilderSidebarItemsPanel";
import { EquipmentTab, type EquipmentEditorSlot } from "./EquipmentTab";
import {
  LiveSheetCollapsibleSection,
  liveSheetSectionBodyStyle,
  liveSheetSummaryStyle
} from "./LiveSheetCollapsibleSection";
import { GlossaryTooltipRichText, RulesRichText } from "./RulesRichText";
import { CharacterPowerCard, powerCardUsageBucketFromLabel } from "../../ui/powerCard";
import { rulesPageShellStyle, rulesStickyTabBarStyle } from "../../ui/panels";
import { FloatingHoverPanel } from "../../ui/FloatingHoverPanel";
import { HybridClassDetailPanel } from "../../ui/HybridClassDetailPanel";
import { useGlossaryTooltip } from "../../ui/useGlossaryTooltip";
import { SupportPassiveMotionBreakdown } from "../shared/SupportPassiveMotionBreakdown";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";
import { BuilderTabCarousel, type BuilderTabCarouselItem } from "../../ui/BuilderTabCarousel";
import { CollapsibleDisclosure, CollapsibleDisclosureArrow } from "../../ui/CollapsibleDisclosure";
import { blockSubsectionStyle, disclosureSummaryStyle } from "../../ui/disclosureStyles";
import { builderSectionTitleStyle, pageTitleStyle } from "../../ui/panels";
import { JsonCollapsiblePanel } from "../../ui/JsonCollapsiblePanel";
import { resolveUiGlossaryHoverPlainText, termHasPowerKeywordTooltipBody } from "../../data/glossaryHoverResolve";
import {
  ensureSelectedEntityInFiltered,
  EMPTY_FEAT_SOURCE_FILTER,
  ensureSelectedFeatsInList,
  FEAT_TIER_OPTIONS,
  filterFeatOptions,
  getFeatDisplayTags,
  getFeatFacetCategory,
  filterPowersByQuery,
  filterRulesEntitiesByQuery,
  sortFeatOptions,
  type FeatSourceFilter,
  type FeatTier
} from "./featPowerFilters";
import { FeatFacetMultiSelect } from "./FeatFacetMultiSelect";
import { FeatSourceFilterDropdown } from "./FeatSourceFilterDropdown";
import { FeatTagPill } from "./FeatTagPill";

interface Props {
  index: RulesIndex;
  tooltipGlossary: Record<string, string>;
}

/** Synthetic / pseudoclass rows from the CB extract — not offered as playable classes. */
const CLASS_NAMES_EXCLUDED_FROM_SELECT = new Set(["Any Class", "Order Adept Pseudoclass"]);

/** Role bucket rows (Defender / Leader / etc.) stored as fake “classes” in some extracts. */
const ROLE_LABELS_EXCLUDED_FROM_CLASS_SELECT = new Set(["defender", "leader", "striker", "controller"]);

function isExcludedFromClassSelect(name: string): boolean {
  if (CLASS_NAMES_EXCLUDED_FROM_SELECT.has(name)) return true;
  return ROLE_LABELS_EXCLUDED_FROM_CLASS_SELECT.has(name.trim().toLowerCase());
}

type BuilderAbilityCode = "STR" | "CON" | "DEX" | "INT" | "WIS" | "CHA";

type BuilderGlossaryKey =
  | "race"
  | "class"
  | "level"
  | "hp"
  | "surges"
  | "surgeValue"
  | "skills"
  | "abilityScores"
  | "ac"
  | "fortitude"
  | "reflex"
  | "will"
  | "speed"
  | "initiative"
  | `ability:${BuilderAbilityCode}`
  | `skill:${string}`
  | `powerKeyword:${string}`
  | `powerUsage:${"atWill" | "encounter" | "daily"}`;

const BUILDER_GLOSSARY_TOOLTIP_ID = "builder-glossary-tooltip";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildRulesIdLookup(index: RulesIndex): Map<string, unknown> {
  const lookup = new Map<string, unknown>();
  for (const value of Object.values(index) as unknown[]) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (!isPlainObject(entry)) continue;
      const idValue = entry.id;
      if (typeof idValue !== "string" || !idValue.trim()) continue;
      if (!lookup.has(idValue)) {
        lookup.set(idValue, entry);
      }
    }
  }
  return lookup;
}

function isResolvableIdKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "id") return false;
  return /ids?$/i.test(trimmed);
}

function expandJsonIds(
  value: unknown,
  rulesById: Map<string, unknown>,
  ancestry: Set<string> = new Set()
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => expandJsonIds(entry, rulesById, ancestry));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, rawChild] of Object.entries(value)) {
    if (key === "raw") {
      continue;
    }
    if (isResolvableIdKey(key)) {
      if (typeof rawChild === "string") {
        const matched = rulesById.get(rawChild);
        if (matched && !ancestry.has(rawChild)) {
          const nextAncestry = new Set(ancestry);
          nextAncestry.add(rawChild);
          next[key] = expandJsonIds(matched, rulesById, nextAncestry);
        } else {
          next[key] = rawChild;
        }
        continue;
      }
      if (Array.isArray(rawChild)) {
        next[key] = rawChild.map((entry) => {
          if (typeof entry !== "string") return expandJsonIds(entry, rulesById, ancestry);
          const matched = rulesById.get(entry);
          if (!matched || ancestry.has(entry)) return entry;
          const nextAncestry = new Set(ancestry);
          nextAncestry.add(entry);
          return expandJsonIds(matched, rulesById, nextAncestry);
        });
        continue;
      }
    }
    next[key] = expandJsonIds(rawChild, rulesById, ancestry);
  }
  return next;
}

function renderPowerCard(
  power: Power,
  options?: {
    key?: string;
    rulesIndex?: RulesIndex;
    keywordTooltip?: (keyword: string) => string | null;
    onKeywordMouseEnter?: (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, keyword: string) => void;
    onKeywordMouseLeave?: () => void;
    glossaryHover?: {
      start: (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, key: BuilderGlossaryKey) => void;
      leave: () => void;
    };
    renderRuleText?: (raw: string, keyPrefix: string) => JSX.Element;
    featModsByPowerId?: ReturnType<typeof collectFeatModificationsByPowerId>;
  }
): JSX.Element {
  const featMods = options?.featModsByPowerId?.get(power.id);
  const usageBucketForGlossary = powerCardUsageBucketFromLabel(
    String((power.raw?.specific as Record<string, unknown> | undefined)?.["Power Usage"] || power.usage || "-")
  );

  return (
    <CharacterPowerCard
      key={options?.key || power.id}
      power={power}
      featMods={featMods}
      rulesIndex={options?.rulesIndex}
      variant="builder"
      renderUsageInHeader={(usageLabel) =>
        usageBucketForGlossary && options?.glossaryHover ? (
          <span
            onMouseEnter={(event) => options.glossaryHover!.start(event, `powerUsage:${usageBucketForGlossary}`)}
            onMouseLeave={options.glossaryHover.leave}
            onFocus={(event) => options.glossaryHover!.start(event, `powerUsage:${usageBucketForGlossary}`)}
            onBlur={options.glossaryHover.leave}
            tabIndex={0}
            style={{
              cursor: "help",
              textDecoration: "underline dotted",
              textUnderlineOffset: "2px",
              color: "var(--text-muted)"
            }}
          >
            {usageLabel}
          </span>
        ) : (
          usageLabel
        )
      }
      renderKeyword={(keyword) => {
        const tooltip = options?.keywordTooltip?.(keyword) ?? null;
        const hasHoverHandlers = Boolean(options?.onKeywordMouseEnter && options?.onKeywordMouseLeave);
        const isParalysisKeyword = keyword.trim().toLowerCase() === "paralysis";
        if (isParalysisKeyword) {
          return <span style={{ color: "var(--text-primary)" }}>{keyword}</span>;
        }
        return (
          <span
            onMouseEnter={hasHoverHandlers ? (event) => options?.onKeywordMouseEnter?.(event, keyword) : undefined}
            onMouseLeave={hasHoverHandlers ? options?.onKeywordMouseLeave : undefined}
            onFocus={hasHoverHandlers ? (event) => options?.onKeywordMouseEnter?.(event, keyword) : undefined}
            onBlur={hasHoverHandlers ? options?.onKeywordMouseLeave : undefined}
            tabIndex={hasHoverHandlers ? 0 : undefined}
            style={{
              color: "var(--text-primary)",
              cursor: hasHoverHandlers || Boolean(tooltip) ? "help" : "default",
              textDecoration: hasHoverHandlers || Boolean(tooltip) ? "underline dotted" : "none",
              textUnderlineOffset: "2px"
            }}
          >
            {keyword}
          </span>
        );
      }}
      renderLineText={(text, segmentKey) =>
        options?.renderRuleText ? options.renderRuleText(text, segmentKey) : text
      }
      renderBody={(body) => (
        <RulesRichText
          text={body}
          paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
          listItemStyle={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
        />
      )}
      renderAugmentationText={(text) => (
        <RulesRichText
          text={text}
          paragraphStyle={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}
          listItemStyle={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
        />
      )}
    />
  );
}

function PowerConstructionSelects(props: {
  power: Power;
  build: CharacterBuild;
  onChange: (next: CharacterBuild) => void;
}): JSX.Element | null {
  const groups = props.power.powerSelectionGroups;
  if (!groups || groups.length === 0) return null;
  const cur = props.build.powerSelections?.[props.power.id] ?? {};
  return (
    <div
      style={{
        marginTop: "0.35rem",
        padding: "0.4rem 0.55rem",
        backgroundColor: "var(--surface-2)",
        borderRadius: "6px",
        border: "1px solid var(--panel-border)"
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: "0.35rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        Power options
      </div>
      {groups.map((g) => (
        <label key={g.key} style={{ display: "block", marginBottom: "0.45rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
          {g.label}
          <select
            value={cur[g.key] || ""}
            onChange={(e) => {
              const v = e.target.value;
              const prev = props.build.powerSelections ?? {};
              const inner = { ...(prev[props.power.id] ?? {}) };
              if (v) inner[g.key] = v;
              else delete inner[g.key];
              const nextPs = { ...prev };
              if (Object.keys(inner).length) nextPs[props.power.id] = inner;
              else delete nextPs[props.power.id];
              props.onChange({
                ...props.build,
                powerSelections: Object.keys(nextPs).length ? nextPs : undefined
              });
            }}
            style={{
              width: "100%",
              maxWidth: "28rem",
              marginTop: "0.2rem",
              padding: "0.35rem",
              borderRadius: "6px",
              border: "1px solid var(--panel-border-strong)",
              boxSizing: "border-box",
              fontSize: "0.82rem"
            }}
          >
            <option value="">— Choose —</option>
            {g.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {(() => {
            const sel = g.options.find((o) => o.id === cur[g.key]);
            return sel?.shortDescription ? (
              <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>{sel.shortDescription}</p>
            ) : null;
          })()}
        </label>
      ))}
    </div>
  );
}

const abilities: Array<keyof CharacterBuild["abilityScores"]> = ["STR", "CON", "DEX", "INT", "WIS", "CHA"];
type BuilderTab =
  | "race"
  | "class"
  | "abilities"
  | "skills"
  | "feats"
  | "powers"
  | "theme"
  | "paragonPath"
  | "epicDestiny"
  | "equipment";

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatAbilityMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const POINT_BUY_RELATIVE_TO_10: Record<number, number> = {
  8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 9, 17: 12, 18: 16
};
const DEFAULT_POINT_BUY_BUDGET = 22;

/** Builder layout shells; parchment background matches character sheet (rulesPageShellStyle). */
const ui = {
  page: {
    ...rulesPageShellStyle,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "0.65rem",
    alignItems: "stretch" as const,
    padding: "clamp(0.75rem, 1.5vw, 1.25rem)",
    minHeight: "100%",
    width: "100%"
  },
  stickyTabBar: {
    ...rulesStickyTabBarStyle
  },
  builderBody: {
    minWidth: 0,
    maxWidth: "100%",
    width: "100%",
    overflowX: "hidden" as const
  },
  bodyRow: {
    display: "flex" as const,
    gap: "0.65rem",
    alignItems: "start" as const,
    minWidth: 0,
    maxWidth: "100%",
    width: "100%"
  },
  chromeFields: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "0.75rem 1.25rem",
    alignItems: "end",
    marginTop: "0.55rem"
  },
  mainColumn: {
    minWidth: 0,
    maxWidth: "100%",
    overflowX: "auto" as const,
    backgroundColor: "var(--surface-0)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 12px)",
    padding: "1.25rem 1.35rem",
    boxShadow: "var(--ui-panel-shadow, 0 1px 4px rgba(15, 23, 42, 0.06))"
  },
  sidebarStack: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "0.65rem",
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box" as const
  },
  sidebarPanel: {
    minWidth: 0,
    maxWidth: "100%",
    width: "100%",
    boxSizing: "border-box" as const,
    overflowX: "hidden" as const,
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 12px)",
    padding: "1.25rem 1.35rem",
    boxShadow: "var(--ui-panel-shadow, 0 1px 4px rgba(15, 23, 42, 0.06))"
  },
  validationColumn: {
    backgroundColor: "var(--surface-1)"
  },
  sidebarColumn: {
    backgroundColor: "var(--surface-2)"
  },
  blockTitle: {
    backgroundColor: "var(--surface-1)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 10px)",
    padding: "1rem 1.1rem",
    marginBottom: "0.9rem"
  },
  blockTabs: {
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 10px)",
    padding: "0.55rem 0.65rem",
    marginBottom: "1rem"
  },
  /** Bordered inset for standalone panels (sidebar, JSON shell). */
  blockInset: {
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-panel-radius, 8px)",
    padding: "0.65rem 0.85rem"
  },
  /** Subsection inside `mainColumn` — no second border (see UI bible). */
  blockSubsection: blockSubsectionStyle,
  blockSheetSection: {
    backgroundColor: "var(--surface-3)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-panel-radius, 8px)",
    padding: "0.75rem 0.9rem",
    marginTop: "0.75rem"
  },
  equipmentSubPanel: {
    backgroundColor: "var(--surface-0)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-panel-radius, 0.35rem)",
    padding: "0.55rem",
    boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
  }
};

const pageHeaderRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem 1rem",
  minWidth: 0
};

const persistenceToolbarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  alignItems: "center",
  justifyContent: "flex-end",
  flex: "1 1 12rem",
  minWidth: 0
};

const savedCharacterPickerDialogStyle: CSSProperties = {
  border: "1px solid var(--panel-border)",
  borderRadius: "12px",
  padding: "1.25rem",
  backgroundColor: "var(--surface-0)",
  color: "var(--text-primary)",
  width: "min(100vw - 2rem, 24rem)",
  maxHeight: "min(90vh, 420px)",
  margin: "auto",
  boxShadow: "var(--ui-panel-shadow, 0 18px 48px rgba(15, 23, 42, 0.25))"
};

type SavedCharacterPickerAction = "load" | "delete";

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 0.45rem 0",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

function exportBuild(build: CharacterBuild): void {
  const blob = new Blob([JSON.stringify(build, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${build.name || "character"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBuildFromFile(
  file: File,
  index: RulesIndex,
  onLoaded: (build: CharacterBuild) => void
): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      onLoaded(normalizeCharacterBuild(JSON.parse(String(reader.result)) as CharacterBuild, index));
    } catch {
      alert("Could not parse character JSON file.");
    }
  };
  reader.readAsText(file);
}

type BuilderPersistenceToolbarProps = {
  index: RulesIndex;
  build: CharacterBuild;
  nameDraft: string;
  commitNameDraft: () => CharacterBuild;
  onBuildChange: (build: CharacterBuild) => void;
  savedCharacters: ReturnType<typeof loadSavedCharacters>;
  onSavedCharactersChange: () => void;
  activeSavedCharacterId: string;
  onActiveSavedCharacterIdChange: (id: string) => void;
};

function effectiveBuilderBuild(build: CharacterBuild, nameDraft: string): CharacterBuild {
  return nameDraft === build.name ? build : { ...build, name: nameDraft };
}

function resolveSaveOverwriteTarget(
  entries: ReturnType<typeof loadSavedCharacters>,
  requestedName: string,
  activeSavedCharacterId: string
): SavedCharacterEntry | undefined {
  const existingByName = entries.find(
    (entry) => entry.name.trim().toLowerCase() === requestedName.toLowerCase()
  );
  const existingByActiveId = activeSavedCharacterId
    ? entries.find((entry) => entry.id === activeSavedCharacterId)
    : undefined;
  return existingByName ?? existingByActiveId;
}

function builderHasUnsavedChanges(
  build: CharacterBuild,
  index: RulesIndex,
  activeSavedCharacterId: string,
  savedCharacters: SavedCharacterEntry[]
): boolean {
  const current = normalizeCharacterBuild(build, index);
  if (activeSavedCharacterId) {
    const saved = savedCharacters.find((entry) => entry.id === activeSavedCharacterId);
    if (saved) {
      return JSON.stringify(current) !== JSON.stringify(normalizeCharacterBuild(saved.build, index));
    }
  }
  const baseline = normalizeCharacterBuild(defaultBuild, index);
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

function BuilderPersistenceToolbar({
  index,
  build,
  nameDraft,
  commitNameDraft,
  onBuildChange,
  savedCharacters,
  onSavedCharactersChange,
  activeSavedCharacterId,
  onActiveSavedCharacterIdChange
}: BuilderPersistenceToolbarProps): JSX.Element {
  const importInputRef = useRef<HTMLInputElement>(null);
  const pickerDialogRef = useRef<HTMLDialogElement>(null);
  const pickerTitleId = useId();
  const [pickerAction, setPickerAction] = useState<SavedCharacterPickerAction | null>(null);
  const [pickerSelectedId, setPickerSelectedId] = useState("");

  const effectiveBuild = useMemo(() => effectiveBuilderBuild(build, nameDraft), [build, nameDraft]);
  const hasUnsavedChanges = useMemo(
    () => builderHasUnsavedChanges(effectiveBuild, index, activeSavedCharacterId, savedCharacters),
    [effectiveBuild, index, activeSavedCharacterId, savedCharacters]
  );

  useEffect(() => {
    const el = pickerDialogRef.current;
    if (!el) return;
    function onClose(): void {
      setPickerAction(null);
      setPickerSelectedId("");
    }
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  function openPicker(action: SavedCharacterPickerAction): void {
    if (savedCharacters.length === 0) {
      alert(action === "load" ? "No saved characters to load." : "No saved characters to delete.");
      return;
    }
    setPickerAction(action);
    setPickerSelectedId(savedCharacters[0].id);
    pickerDialogRef.current?.showModal();
  }

  function closePicker(): void {
    pickerDialogRef.current?.close();
  }

  function confirmPicker(): void {
    const selected = savedCharacters.find((entry) => entry.id === pickerSelectedId);
    if (!selected) {
      alert("Selected saved character could not be found.");
      onSavedCharactersChange();
      closePicker();
      return;
    }
    if (pickerAction === "load") {
      const shouldLoad = window.confirm(
        `Load "${selected.name}" into the builder? This replaces your current in-progress character.`
      );
      if (!shouldLoad) return;
      onBuildChange({ ...selected.build });
      onActiveSavedCharacterIdChange(selected.id);
      alert(`Loaded "${selected.name}".`);
    } else if (pickerAction === "delete") {
      const shouldDelete = window.confirm(`Delete saved character "${selected.name}"? This cannot be undone.`);
      if (!shouldDelete) return;
      const deleted = deleteSavedCharacterById(selected.id);
      onSavedCharactersChange();
      if (selected.id === activeSavedCharacterId) {
        onActiveSavedCharacterIdChange("");
      }
      if (deleted) {
        alert(`Deleted "${selected.name}".`);
      } else {
        alert("Saved character was not found.");
      }
    }
    closePicker();
  }

  return (
    <>
    <div style={persistenceToolbarStyle} aria-label="Character file actions">
      <button
        type="button"
        className={hasUnsavedChanges ? "builder-persistence-save--unsaved" : undefined}
        title={hasUnsavedChanges ? "Unsaved changes — save to Character Sheet" : undefined}
        aria-label={hasUnsavedChanges ? "Save character (unsaved changes)" : "Save character"}
        onClick={() => {
          const buildToSave = commitNameDraft();
          const requestedName = (buildToSave.name || "Unnamed Character").trim() || "Unnamed Character";
          const entries = loadSavedCharacters();
          const overwriteTarget = resolveSaveOverwriteTarget(entries, requestedName, activeSavedCharacterId);
          if (overwriteTarget) {
            const confirmed = window.confirm(
              `A saved character named "${overwriteTarget.name}" already exists. Overwrite it?`
            );
            if (!confirmed) return;
          }
          const result = saveBuildToSavedCharacters(buildToSave, {
            overwriteEntryId: overwriteTarget?.id
          });
          onSavedCharactersChange();
          onActiveSavedCharacterIdChange(result.entry.id);
          const actionLabel = result.overwritten ? "Overwrote" : "Saved";
          alert(`${actionLabel} "${result.entry.name}" for Character Sheet.`);
        }}
      >
        Save{hasUnsavedChanges ? " *" : ""}
      </button>
      <button type="button" onClick={() => openPicker("load")}>
        Load
      </button>
      <button type="button" onClick={() => exportBuild(commitNameDraft())}>
        Export
      </button>
      <button type="button" onClick={() => importInputRef.current?.click()}>
        Import
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            importBuildFromFile(file, index, (next) => {
              onBuildChange(next);
              onActiveSavedCharacterIdChange("");
            });
          }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (
            hasUnsavedChanges &&
            !window.confirm("Reset the builder? Unsaved changes to this character will be lost.")
          ) {
            return;
          }
          onBuildChange(defaultBuild);
          onActiveSavedCharacterIdChange("");
        }}
      >
        Reset
      </button>
      <button type="button" onClick={() => openPicker("delete")}>
        Delete
      </button>
    </div>
    <dialog ref={pickerDialogRef} aria-labelledby={pickerTitleId} style={savedCharacterPickerDialogStyle}>
      <h2 id={pickerTitleId} style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
        {pickerAction === "delete" ? "Delete character" : "Load character"}
      </h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxHeight: "16rem",
          overflowY: "auto"
        }}
      >
        {savedCharacters.map((entry) => (
          <li key={entry.id} style={{ marginBottom: "0.35rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer"
              }}
            >
              <input
                type="radio"
                name="saved-character-picker"
                checked={pickerSelectedId === entry.id}
                onChange={() => setPickerSelectedId(entry.id)}
              />
              <span>
                {entry.name}{" "}
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  ({formatSavedCharacterClassLevel(entry.build, index)} ·{" "}
                  {new Date(entry.updatedAt).toLocaleString()})
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={closePicker}>
          Cancel
        </button>
        <button type="button" onClick={confirmPicker}>
          {pickerAction === "delete" ? "Delete" : "Load"}
        </button>
      </div>
    </dialog>
    </>
  );
}

export function CharacterBuilderApp({ index, tooltipGlossary }: Props): JSX.Element {
  const [build, setBuild] = useState<CharacterBuild>(() => {
    const loaded = loadBuild();
    return loaded ? normalizeCharacterBuild(loaded, index) : defaultBuild;
  });
  const [nameDraft, setNameDraft] = useState(build.name);
  const [savedCharacters, setSavedCharacters] = useState(() => loadSavedCharacters());
  const [activeSavedCharacterId, setActiveSavedCharacterId] = useState("");
  const prevAutoGrantedSkillIdsRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<BuilderTab>("race");
  const [featSearch, setFeatSearch] = useState("");
  const [featFilterAllText, setFeatFilterAllText] = useState(false);
  const [showInvalidFeats, setShowInvalidFeats] = useState(false);
  const [featTierFilter, setFeatTierFilter] = useState<FeatTier[]>([]);
  const [featCategoryFilter, setFeatCategoryFilter] = useState<string[]>([]);
  const [featSourceFilter, setFeatSourceFilter] = useState<FeatSourceFilter>(EMPTY_FEAT_SOURCE_FILTER);
  const [powerSearch, setPowerSearch] = useState("");
  const [themeSearch, setThemeSearch] = useState("");
  const [paragonSearch, setParagonSearch] = useState("");
  const [epicSearch, setEpicSearch] = useState("");
  const [useSingleColumnLayout, setUseSingleColumnLayout] = useState(() => window.innerWidth <= 1380);
  const [builderSidebarCollapsed, setBuilderSidebarCollapsed] = useState(false);
  const glossaryTooltipUi = useGlossaryTooltip({ tooltipId: BUILDER_GLOSSARY_TOOLTIP_ID });
  const glossaryTermLookupCacheRef = useRef<Map<string, boolean>>(new Map());
  const rulesById = useMemo(() => buildRulesIdLookup(index), [index]);

  const selectedRace = index.races.find((r) => r.id === build.raceId);
  const selectedClass = index.classes.find((c) => c.id === build.classId);
  const selectedTheme = index.themes.find((t) => t.id === build.themeId);
  const selectedParagonPath = index.paragonPaths.find((p) => p.id === build.paragonPathId);
  const selectedEpicDestiny = index.epicDestinies.find((d) => d.id === build.epicDestinyId);
  const effectiveEquipmentIds = useMemo(() => resolveEffectiveEquipmentIds(build, index), [build, index]);
  const selectedArmor = index.armors.find((a) => a.id === effectiveEquipmentIds.armorId);
  const selectedShield = index.armors.find((a) => a.id === effectiveEquipmentIds.shieldId);
  const selectedMainWeapon = (index.weapons ?? []).find((w) => w.id === effectiveEquipmentIds.mainWeaponId);
  const selectedOffHandWeapon = (index.weapons ?? []).find((w) => w.id === effectiveEquipmentIds.offHandWeaponId);
  const selectedImplement = (index.implements ?? []).find((i) => i.id === effectiveEquipmentIds.implementId);
  const isHybridBuild = build.characterStyle === "hybrid";
  const selectedHybridA: HybridClassDef | undefined = index.hybridClasses?.find((h) => h.id === build.hybridClassIdA);
  const selectedHybridB: HybridClassDef | undefined = index.hybridClasses?.find((h) => h.id === build.hybridClassIdB);
  const hybridBaseClassAId = selectedHybridA?.baseClassId;
  const hybridBaseClassBId = selectedHybridB?.baseClassId;
  const hybridBaseClassDefA = hybridBaseClassAId ? index.classes.find((c) => c.id === hybridBaseClassAId) : undefined;
  const hybridBaseClassDefB = hybridBaseClassBId ? index.classes.find((c) => c.id === hybridBaseClassBId) : undefined;
  const classIdForDilettante = isHybridBuild ? hybridBaseClassAId : build.classId;
  const hybridClassSelectionComplete = isHybridBuild && !!selectedHybridA && !!selectedHybridB;
  const raceSpecific = (selectedRace?.raw?.specific as Record<string, unknown> | undefined) || {};
  const classSpecific = (selectedClass?.raw?.specific as Record<string, unknown> | undefined) || {};
  const classFeatureChoiceGroups = useMemo(
    () => getClassFeatureChoiceGroups(index, selectedClass),
    [index, selectedClass]
  );
  const visibleClassFeatureChoiceGroups = useMemo(
    () => filterVisibleClassFeatureChoiceGroups(classFeatureChoiceGroups, build.classSelections),
    [classFeatureChoiceGroups, build.classSelections]
  );
  const autoGrantedSkillIds = useMemo(() => autoGrantedTrainedSkillIds(index, build), [index, build]);
  const autoGrantedSkillIdSet = useMemo(() => new Set(autoGrantedSkillIds), [autoGrantedSkillIds]);
  const expandedBuildJson = useMemo(
    () => JSON.stringify(expandJsonIds(build, rulesById), null, 2),
    [build, rulesById]
  );
  const skillById = useMemo(() => new Map(index.skills.map((skill) => [skill.id, skill])), [index.skills]);
  const racialTraitById = useMemo(
    () => new Map<string, RacialTrait>((index.racialTraits ?? []).map((t) => [t.id, t])),
    [index.racialTraits]
  );
  const classFeatureById = useMemo(
    () => new Map<string, ClassFeature>((index.classFeatures ?? []).map((f) => [f.id, f])),
    [index.classFeatures]
  );
  const classTraitRows = useMemo((): TraitDisplayRow[] => {
    if (isHybridBuild) {
      if (!hybridClassSelectionComplete) return [];
      return getHybridClassTraitRows(selectedHybridA, selectedHybridB, index, build.level);
    }
    return getClassTraitRows(selectedClass, index, build.level);
  }, [
    isHybridBuild,
    hybridClassSelectionComplete,
    selectedHybridA,
    selectedHybridB,
    selectedClass,
    index,
    build.level
  ]);
  const raceTraitBundleSlots = useMemo(
    () => getRaceTraitBundleSlots(selectedRace, racialTraitById),
    [selectedRace, racialTraitById]
  );
  const raceExtraTraitIds = useMemo(
    () => getRaceExtraTraitIds(selectedRace, racialTraitById, build.raceSelections, index.races),
    [selectedRace, racialTraitById, build.raceSelections, index.races]
  );
  const racialTraitRuleSelectSlotsRaceTab = useMemo(
    () =>
      getRacialTraitRuleSelectSlotsForRaceTab(
        selectedRace,
        racialTraitById,
        build.raceSelections,
        selectedClass,
        index.races
      ),
    [selectedRace, racialTraitById, build.raceSelections, selectedClass, index.races]
  );
  const racialFeatSlotCount = useMemo(
    () => resolveRacialFeatSlotCountForBuild(index, build),
    [index, build.raceId, build.raceSelections, build.classId, build.characterStyle]
  );
  const racialSkillTrainingSlotCount = useMemo(
    () => resolveRacialSkillTrainingSlotCountForBuild(index, build),
    [index, build.raceId, build.raceSelections, build.classId, build.characterStyle]
  );
  const countsAsRacePickOptions = useMemo(
    () => countsAsRaceOptions(index, build.raceId),
    [index, build.raceId]
  );
  const raceAbilityBonusInfo = useMemo(
    () => resolveRaceAbilityBonusInfo(selectedRace, racialTraitById, build.raceSelections),
    [selectedRace, racialTraitById, build.raceSelections]
  );
  const raceAbilityScoresDisplay = useMemo(() => {
    if (!selectedRace) return "-";
    if (raceDefersAbilityBonusToSubrace(selectedRace)) {
      if (!build.raceSelections?.subrace) return "See the Race Chosen";
      const summary = formatRaceAbilityBonusSummary(raceAbilityBonusInfo);
      return summary || "See the Race Chosen";
    }
    return String(raceSpecific["Ability Scores"] || selectedRace.abilitySummary || "-");
  }, [selectedRace, build.raceSelections?.subrace, raceAbilityBonusInfo, raceSpecific]);
  const raceSecondarySlots = useMemo(() => getRaceSecondarySelectSlots(selectedRace), [selectedRace]);
  const bonusLanguageOptions = useMemo(
    () =>
      selectableStartingLanguages(index.languages ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [index.languages]
  );
  const displayedRacialTraitRows = useMemo(
    () => resolveDisplayedRacialTraitsForRace(selectedRace, racialTraitById, build.raceSelections),
    [selectedRace, racialTraitById, build.raceSelections]
  );
  const scoresAfterLevel = useMemo(
    () => applyAsiBonusesToScores(build.abilityScores, build.level, build.asiChoices),
    [build.abilityScores, build.level, build.asiChoices]
  );
  const effectiveAbilityScores = useMemo(
    () => applyRacialBonuses(scoresAfterLevel, raceAbilityBonusInfo, build.racialAbilityChoice),
    [scoresAfterLevel, build.racialAbilityChoice, raceAbilityBonusInfo]
  );
  const builderAbilityScoreRows = useMemo(
    (): ScoreBreakdownRowDef[] =>
      abilities.map((ability) => {
        const base = build.abilityScores[ability];
        const postLevel = scoresAfterLevel[ability];
        const final = effectiveAbilityScores[ability];
        return {
          rowKey: ability,
          label: ability,
          glossaryKey: `ability:${ability}`,
          total: abilityModifier(final),
          signedTotal: true,
          values: {
            base,
            level: postLevel - base,
            racial: final - postLevel,
            score: final
          }
        };
      }),
    [build.abilityScores, scoresAfterLevel, effectiveAbilityScores]
  );
  const renderBuilderAbilityLabel = useCallback(
    (row: ScoreBreakdownRowDef, stripe: string) => (
      <span
        {...glossaryTooltipUi.hoverA11y(row.glossaryKey ?? `ability:${row.rowKey}`)}
        style={{
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--text-primary)",
          padding: "0.12rem 0.2rem",
          ...(stripe !== "transparent" ? { backgroundColor: stripe, borderRadius: "0.2rem" } : {})
        }}
      >
        {row.label}
      </span>
    ),
    [glossaryTooltipUi]
  );
  const renderBuilderAbilityComponent = useCallback(
    (row: ScoreBreakdownRowDef, columnKey: string) => {
      const ability = row.rowKey as Ability;
      if (columnKey === "base") {
        return (
          <AdjustableNumberInput
            compact
            min={8}
            max={18}
            value={build.abilityScores[ability]}
            onChange={(next) =>
              updateBuild({
                ...build,
                abilityScores: { ...build.abilityScores, [ability]: next }
              })
            }
            ariaLabel={`${getAbilityLabel(ability)} base score`}
            style={{ maxWidth: "100%" }}
          />
        );
      }
      if (columnKey === "level" || columnKey === "racial") {
        const delta = Number(row.values[columnKey] ?? 0);
        return (
          <span style={{ ...scoreComponentCellStyle, color: delta === 0 ? "var(--text-muted)" : undefined }}>
            {delta > 0 ? `+${delta}` : String(delta)}
          </span>
        );
      }
      return undefined;
    },
    [build]
  );
  const effectiveBuild = useMemo(() => ({ ...build, abilityScores: effectiveAbilityScores }), [build, effectiveAbilityScores]);
  const legality = useMemo(() => validateCharacterBuild(index, build), [index, build]);
  const derived = useMemo(
    () =>
      computeBuilderLikeDerivedStats(
        index,
        effectiveBuild,
        selectedRace,
        selectedArmor,
        selectedShield,
        { legality }
      ),
    [index, effectiveBuild, selectedRace, selectedArmor, selectedShield, legality]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1380px)");
    const onLayoutChange = (event: MediaQueryListEvent): void => {
      setUseSingleColumnLayout(event.matches);
    };
    setUseSingleColumnLayout(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onLayoutChange);
      return () => mediaQuery.removeEventListener("change", onLayoutChange);
    }
    mediaQuery.addListener(onLayoutChange);
    return () => mediaQuery.removeListener(onLayoutChange);
  }, []);

  useEffect(() => {
    glossaryTermLookupCacheRef.current.clear();
  }, [tooltipGlossary, index]);

  useEffect(() => {
    setActiveTab((tab) => {
      if (tab === "paragonPath" && build.level < 11) return "theme";
      if (tab === "epicDestiny" && build.level < 21) return build.level >= 11 ? "paragonPath" : "theme";
      return tab;
    });
  }, [build.level]);

  function glossaryContent(key: BuilderGlossaryKey): JSX.Element {
    const resolved = resolveUiGlossaryHoverPlainText(
      key,
      {
        glossaryByName: tooltipGlossary,
        index,
        selectedRaceName: selectedRace?.name,
        selectedClassName: selectedClass?.name
      },
      "builder"
    );
    if (resolved) return <GlossaryTooltipRichText text={resolved} />;
    if (key.startsWith("ability:") || key.startsWith("skill:")) {
      return <div>No description available.</div>;
    }
    return <div>No glossary entry found in `generated/glossary_terms.json`.</div>;
  }

  function hasGlossaryHoverForTerm(term: string): boolean {
    const normalized = term.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) return false;
    const cache = glossaryTermLookupCacheRef.current;
    const cached = cache.get(normalized);
    if (cached != null) return cached;
    const found = termHasPowerKeywordTooltipBody(term, tooltipGlossary);
    cache.set(normalized, found);
    return found;
  }

  function renderPowerTextWithGlossaryHovers(value: string, keyPrefix: string): JSX.Element {
    const parts = value.split(/(\s+|[,;:/()])/g);
    return (
      <>
        {parts.map((part, idx) => {
          const term = part.trim();
          if (!term || !/[A-Za-z]/.test(term) || !hasGlossaryHoverForTerm(term)) {
            return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
          }
          return (
            <span
              key={`${keyPrefix}-${idx}`}
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${term}`)}
              onFocus={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${term}`)}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onBlur={glossaryTooltipUi.leaveHover}
              tabIndex={0}
              style={{
                cursor: "help",
                textDecoration: "underline dotted",
                textUnderlineOffset: "2px"
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  }

  function renderPowerGlossaryRuleText(raw: string, keyPrefix: string): JSX.Element {
    const trimmed = raw.trim();
    if (hasGlossaryHoverForTerm(trimmed)) {
      return (
        <span
          onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${trimmed}`)}
          onFocus={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${trimmed}`)}
          onMouseLeave={glossaryTooltipUi.leaveHover}
          onBlur={glossaryTooltipUi.leaveHover}
          tabIndex={0}
          style={{
            cursor: "help",
            textDecoration: "underline dotted",
            textUnderlineOffset: "2px"
          }}
        >
          {raw}
        </span>
      );
    }
    return renderPowerTextWithGlossaryHovers(raw, keyPrefix);
  }

  const skillSheetRows = useMemo(() => {
    return computeSkillSheetRows(
      index,
      build.level,
      effectiveAbilityScores,
      effectiveTrainedSkillIdSet(index, build),
      derived.armorCheckPenalty,
      derived.supportPassiveOther.skillFlatBySkillId
    );
  }, [index, build.level, effectiveAbilityScores, autoGrantedSkillIds, build.trainedSkillIds, derived.armorCheckPenalty, derived.supportPassiveOther]);
  function powerKeywordTooltip(keyword: string): string | null {
    return resolveUiGlossaryHoverPlainText(
      `powerKeyword:${keyword}`,
      {
        glossaryByName: tooltipGlossary,
        index,
        selectedRaceName: selectedRace?.name,
        selectedClassName: selectedClass?.name
      },
      "builder"
    );
  }

  const classWeaponProfText = useMemo(() => {
    if (isHybridBuild && selectedHybridA && selectedHybridB) {
      return mergeHybridProficiencyLines(selectedHybridA, selectedHybridB).weaponLine;
    }
    return String(classSpecific["Weapon Proficiencies"] || "");
  }, [isHybridBuild, selectedHybridA, selectedHybridB, classSpecific]);
  const classImplementProfText = useMemo(() => {
    if (isHybridBuild && selectedHybridA && selectedHybridB) {
      return mergeHybridProficiencyLines(selectedHybridA, selectedHybridB).implementLine;
    }
    return [classSpecific["Implements"], classSpecific["Implement"]]
      .filter((x): x is string => typeof x === "string")
      .join("; ");
  }, [isHybridBuild, selectedHybridA, selectedHybridB, classSpecific]);
  const proficiencyGrants = useMemo(
    () => collectCharacterProficiencyGrants(index, build),
    [index, build.featIds, build.raceId, build.raceSelections]
  );
  const proficiencyDisplayRows = useMemo(
    () => collectCharacterProficiencyDisplayRows(index, build),
    [index, build.featIds, build.raceId, build.raceSelections]
  );

  const magicCombat = useMemo(() => computeMagicItemCombatBonuses(index, build), [index, build]);
  const builderInventoryItems = useMemo(
    () => characterBuildInventoryItems(build, index),
    [build, index]
  );

  const wieldSlotsForPreview = useMemo(() => {
    const slots: Partial<Record<EquippedSlotKey, string>> = {
      ...build.equippedSlots
    };
    if (effectiveEquipmentIds.offHandWeaponId || effectiveEquipmentIds.shieldId) {
      slots.offHand = slots.offHand ?? "config";
    }
    return slots;
  }, [build.equippedSlots, effectiveEquipmentIds.offHandWeaponId, effectiveEquipmentIds.shieldId]);

  const mainWeaponSummary = useMemo(
    () =>
      summarizeMainWeaponAttack(
        build.level,
        effectiveAbilityScores,
        selectedMainWeapon,
        classWeaponProfText,
        magicCombat.mainWeaponAttack,
        proficiencyGrants,
        "mainHand",
        wieldSlotsForPreview
      ),
    [
      build.level,
      effectiveAbilityScores,
      selectedMainWeapon,
      classWeaponProfText,
      magicCombat.mainWeaponAttack,
      proficiencyGrants,
      wieldSlotsForPreview
    ]
  );
  const offHandWeaponSummary = useMemo(
    () =>
      summarizeMainWeaponAttack(
        build.level,
        effectiveAbilityScores,
        selectedOffHandWeapon,
        classWeaponProfText,
        magicCombat.offHandWeaponAttack,
        proficiencyGrants,
        "offHand",
        wieldSlotsForPreview
      ),
    [
      build.level,
      effectiveAbilityScores,
      selectedOffHandWeapon,
      classWeaponProfText,
      magicCombat.offHandWeaponAttack,
      proficiencyGrants,
      wieldSlotsForPreview
    ]
  );
  const implementAttackSummary = useMemo(
    () =>
      summarizeImplementAttack(
        build.level,
        effectiveAbilityScores,
        hybridBaseClassDefA || selectedClass,
        selectedImplement,
        classImplementProfText,
        magicCombat.implementAttack,
        proficiencyGrants
      ),
    [
      build.level,
      effectiveAbilityScores,
      hybridBaseClassDefA,
      selectedClass,
      selectedImplement,
      classImplementProfText,
      magicCombat.implementAttack,
      proficiencyGrants
    ]
  );
  const multiclassFeatIdList = useMemo(() => multiclassFeatIds(index, build), [index, build]);
  const multiclassEntryFeatIdList = useMemo(
    () => collectMulticlassEntryFeatIds(index, build),
    [index, build]
  );
  const countsAsClassLabels = useMemo(() => collectCountsAsClassNames(index, build), [index, build]);
  const countsAsFeatureLabels = useMemo(() => collectCountsAsFeatureNames(index, build), [index, build]);
  const internalGrantKeyList = useMemo(() => collectInternalGrantKeys(index, build), [index, build]);
  const paragonMcEligible = useMemo(() => canChooseParagonMulticlassing(index, build), [index, build]);
  const paragonMcClassId = useMemo(() => multiclassEntryClassId(index, build), [index, build]);
  const paragonMcClassName = useMemo(
    () => (paragonMcClassId ? index.classes.find((c) => c.id === paragonMcClassId)?.name : undefined),
    [index.classes, paragonMcClassId]
  );
  const paragonMcPowerOptions = useMemo(() => {
    if (!paragonMcClassId) {
      return { atWill: [], encounter: [], utility: [], daily: [] };
    }
    const atk7 = paragonMulticlassAttackPowers(index, paragonMcClassId, 7);
    const atkAll = paragonMulticlassAttackPowers(index, paragonMcClassId, build.level);
    const atk19 = paragonMulticlassAttackPowers(index, paragonMcClassId, 19);
    const util10 = paragonMulticlassUtilityPowers(index, paragonMcClassId, 10);
    return {
      atWill: filterParagonMulticlassAtWillOptions(atkAll),
      encounter: filterParagonMulticlassEncounterOptions(atk7),
      utility: util10,
      daily: filterParagonMulticlassDailyOptions(atk19)
    };
  }, [index, paragonMcClassId, build.level]);
  const hasKiFocus = useMemo(() => characterHasKiFocusUser(index, build), [index, build]);
  const hasPsionicSecond = useMemo(() => characterHasPsionicSecondClass(index, build), [index, build]);

  const featOptions = useMemo(() => resolveFeatOptions(index, effectiveBuild), [index, effectiveBuild]);
  const allLegalFeats = useMemo(() => featOptions.filter((f) => f.legal), [featOptions]);
  const displayedFeatOptions = useMemo(
    () => (showInvalidFeats ? featOptions : featOptions.filter((f) => f.legal)),
    [featOptions, showInvalidFeats]
  );
  const expectedFeatCount = useMemo(
    () => totalFeatSlots(build.level, racialFeatSlotCount),
    [build.level, racialFeatSlotCount]
  );
  const filteredFeatRows = useMemo(() => {
    const filtered = filterFeatOptions(displayedFeatOptions, {
      query: featSearch,
      filterAllText: featFilterAllText,
      tiers: featTierFilter,
      categories: featCategoryFilter,
      source: featSourceFilter
    });
    const sorted = sortFeatOptions(filtered, "tier-alpha");
    // Text filter is inclusive-only; do not prepend selected feats that fail the query.
    if (featSearch.trim()) return sorted;
    return ensureSelectedFeatsInList(sorted, build.featIds, featOptions);
  }, [displayedFeatOptions, featSearch, featFilterAllText, featTierFilter, featCategoryFilter, featSourceFilter, build.featIds, featOptions]);
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
  const classAttackPowers = useMemo(() => {
    if (isHybridBuild && hybridBaseClassAId && hybridBaseClassBId) {
      return hybridPowerPoolUnion(index, hybridBaseClassAId, hybridBaseClassBId, build.level, "attack");
    }
    return getClassPowersForLevelRange(index, build.classId, build.level, "attack");
  }, [index, build.classId, build.level, isHybridBuild, hybridBaseClassAId, hybridBaseClassBId]);
  const classUtilityPowers = useMemo(() => {
    if (isHybridBuild && hybridBaseClassAId && hybridBaseClassBId) {
      return hybridPowerPoolUnion(index, hybridBaseClassAId, hybridBaseClassBId, build.level, "utility");
    }
    return getClassPowersForLevelRange(index, build.classId, build.level, "utility");
  }, [index, build.classId, build.level, isHybridBuild, hybridBaseClassAId, hybridBaseClassBId]);
  const dilettanteCandidatePowers = useMemo(
    () => getDilettanteCandidatePowersForBuild(index, build),
    [index, build.characterStyle, build.classId, build.hybridClassIdA, build.hybridClassIdB]
  );
  const dilettantePowerGroups = useMemo(
    () => dilettanteRacePowerGroupsForBuild(index, build),
    [index, build.raceId, build.raceSelections]
  );
  const paragonPathGrantedPowers = useMemo(() => {
    if (!build.paragonPathId || build.level < 11) return [];
    const atk = getPowersForOwnerId(index, build.paragonPathId, build.level, "attack");
    const util = getPowersForOwnerId(index, build.paragonPathId, build.level, "utility");
    return [...atk, ...util].sort((a, b) => {
      const la = a.level ?? 0;
      const lb = b.level ?? 0;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [index, build.paragonPathId, build.level]);
  const epicDestinyGrantedPowers = useMemo(() => {
    if (!build.epicDestinyId || build.level < 21) return [];
    const atk = getPowersForOwnerId(index, build.epicDestinyId, build.level, "attack");
    const util = getPowersForOwnerId(index, build.epicDestinyId, build.level, "utility");
    return [...atk, ...util].sort((a, b) => {
      const la = a.level ?? 0;
      const lb = b.level ?? 0;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [index, build.epicDestinyId, build.level]);
  const paragonMcGrantedPowers = useMemo(() => {
    if (!build.paragonMulticlassing) return [];
    const all = resolveParagonMulticlassPowers(index, build);
    const awId = build.paragonMulticlassPowers?.atWillSwapPowerId;
    const awSlot = build.paragonMulticlassPowers?.atWillSwapSlotKey;
    if (awId && awSlot) return all.filter((p) => p.id !== awId);
    return all;
  }, [index, build.paragonMulticlassing, build.paragonMulticlassPowers, build.level]);
  const paragonAtWillSlots = useMemo(
    () => (build.paragonMulticlassing ? paragonAtWillSlotDefs(index, build) : []),
    [index, build.paragonMulticlassing, build.level, build.characterStyle, build.raceSelections]
  );
  const psionicPowerPointSummary = useMemo(
    () => summarizePsionicPowerPointAdjustments(index, build),
    [index, build]
  );
  const psionicPoolLabel = useMemo(
    () => psionicAugmentationPoolLabel(index, build),
    [index, build]
  );
  const hybridPsionicAugmentationBreakpoints = useMemo(() => {
    if (build.characterStyle !== "hybrid" || !hybridHasPsionicComponent(index, build)) return [];
    return hybridPsionicAugmentationBreakpointsForLevel(build.level);
  }, [index, build]);
  const themeGrantedPowers = useMemo(() => {
    if (!build.themeId) return [];
    const atk = getPowersForOwnerId(index, build.themeId, build.level, "attack");
    const util = getPowersForOwnerId(index, build.themeId, build.level, "utility");
    return [...atk, ...util].sort((a, b) => {
      const la = a.level ?? 0;
      const lb = b.level ?? 0;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [index, build.themeId, build.level]);
  const upcomingPowerSlotMilestones = useMemo(() => upcomingClassPowerSlotMilestones(build.level), [build.level]);
  const bonusClassAtWill = useMemo(() => bonusClassAtWillSlotFromRaceBuild(index, build), [index, build.raceId, build.raceSelections]);

  function reconcilePowerSlotsForBuild(nextBase: CharacterBuild, lv: number): { classPowerSlots?: Record<string, string>; powerIds: string[] } {
    const bonus = bonusClassAtWillSlotFromRaceBuild(index, nextBase);
    const atWillPenalty = paragonMulticlassPrimaryAtWillSlotPenalty(index, nextBase);
    const defs =
      nextBase.characterStyle === "hybrid"
        ? buildHybridPowerSlotDefinitions(lv, bonus, atWillPenalty)
        : buildClassPowerSlotDefinitions(lv, bonus, atWillPenalty);
    let pruned = pruneFeatPowerReplacements(nextBase, index, defs);
    pruned = pruneMulticlassSlotSwaps(pruned, index, defs);
    if (pruned.characterStyle === "hybrid") {
      const ha = index.hybridClasses?.find((h) => h.id === pruned.hybridClassIdA);
      const hb = index.hybridClasses?.find((h) => h.id === pruned.hybridClassIdB);
      return reconcileHybridClassPowerSlotsForBuild(
        pruned,
        lv,
        bonus,
        index,
        ha?.baseClassId ?? undefined,
        hb?.baseClassId ?? undefined
      );
    }
    return reconcileClassPowerSlotsForBuild(pruned, lv, bonus, index);
  }

  const paragonAtWillPenalty = useMemo(
    () => paragonMulticlassPrimaryAtWillSlotPenalty(index, build),
    [index, build]
  );
  const powerSlotDefs = useMemo(() => {
    if (isHybridBuild) return buildHybridPowerSlotDefinitions(build.level, bonusClassAtWill, paragonAtWillPenalty);
    return buildClassPowerSlotDefinitions(build.level, bonusClassAtWill, paragonAtWillPenalty);
  }, [build.level, bonusClassAtWill, isHybridBuild, paragonAtWillPenalty]);
  const racePowerGroups = useMemo(
    () =>
      racePowerGroupsForRace(selectedRace, racialTraitById, raceExtraTraitIds),
    [selectedRace, racialTraitById, raceExtraTraitIds]
  );
  const classAutoGrantedPowers = useMemo(() => {
    if (isHybridBuild && hybridBaseClassAId && hybridBaseClassBId) {
      const a = autoGrantedClassPowers(index, hybridBaseClassAId);
      const b = autoGrantedClassPowers(index, hybridBaseClassBId);
      const byId = new Map<string, Power>();
      for (const p of [...a, ...b]) byId.set(p.id, p);
      return [...byId.values()].sort((x, y) =>
        x.name.localeCompare(y.name, undefined, { sensitivity: "base" })
      );
    }
    return autoGrantedClassPowers(index, build.classId);
  }, [index, build.classId, isHybridBuild, hybridBaseClassAId, hybridBaseClassBId]);
  const characterPowerIds = useMemo(
    () => collectCharacterPowerIdsForSelections(index, build),
    [index, build]
  );
  const featGrantedPowers = useMemo(
    () => collectFeatGrantedPowersForBuild(index, build),
    [index, build.featIds]
  );
  const featModsByPowerId = useMemo(
    () => collectFeatModificationsByPowerId(index, build.featIds),
    [index, build.featIds]
  );
  const featModifiedPowers = useMemo(
    () => collectFeatModifiedPowersForBuild(index, build, characterPowerIds),
    [index, build.featIds, characterPowerIds]
  );
  const featClassFeatureModifications = useMemo(
    () => collectFeatClassFeatureModificationsForBuild(index, build),
    [index, build]
  );
  const featPowerReplaceRows = useMemo(
    () => collectFeatPowerReplaceRows(index, build, powerSlotDefs),
    [index, build.featIds, build.featPowerReplacements, powerSlotDefs]
  );
  const multiclassSlotSwapRows = useMemo(
    () => collectMulticlassSlotSwapRows(index, build, powerSlotDefs),
    [index, build.featIds, build.level, build.featPowerReplacements, powerSlotDefs]
  );
  const multiclassSwapRowsBySlotKey = useMemo(() => {
    const map = new Map<string, typeof multiclassSlotSwapRows>();
    for (const row of multiclassSlotSwapRows) {
      for (const slot of row.eligibleSlots) {
        const list = map.get(slot.key) ?? [];
        list.push(row);
        map.set(slot.key, list);
      }
    }
    return map;
  }, [multiclassSlotSwapRows]);
  const featReplaceRowsBySlotKey = useMemo(() => {
    const map = new Map<string, typeof featPowerReplaceRows>();
    for (const row of featPowerReplaceRows) {
      for (const slot of row.eligibleSlots) {
        const list = map.get(slot.key) ?? [];
        list.push(row);
        map.set(slot.key, list);
      }
    }
    return map;
  }, [featPowerReplaceRows]);
  const selectedClassSkillNamesLower = new Set((legality.classSkillRules?.classSkillNames || []).map((s) => s.toLowerCase()));
  const skillsSortedAll = useMemo(
    () => [...index.skills].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.skills]
  );
  const raceNameById = useMemo(() => new Map(index.races.map((r) => [r.id, r.name])), [index.races]);
  const classNameById = useMemo(() => new Map(index.classes.map((c) => [c.id, c.name])), [index.classes]);
  const classesForSelect = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        index.classes.filter((c) => !isExcludedFromClassSelect(c.name)),
        build.classId,
        index.classes
      ),
    [index.classes, build.classId]
  );
  const hybridClassesSorted = useMemo(
    () =>
      [...(index.hybridClasses ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [index.hybridClasses]
  );
  const hybridClassesForHybridSelect = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        ensureSelectedEntityInFiltered(hybridClassesSorted, build.hybridClassIdA, hybridClassesSorted),
        build.hybridClassIdB,
        hybridClassesSorted
      ),
    [hybridClassesSorted, build.hybridClassIdA, build.hybridClassIdB]
  );
  const skillNameById = useMemo(() => new Map(index.skills.map((s) => [s.id, s.name])), [index.skills]);
  const requiredClassSkillNamesLower = useMemo(
    () => new Set((legality.classSkillRules?.requiredTrainedSkillNames || []).map((s) => s.toLowerCase())),
    [legality.classSkillRules?.requiredTrainedSkillNames]
  );
  const trainedOptionalClassSkillCount = useMemo(() => {
    let count = 0;
    for (const id of build.trainedSkillIds) {
      const lowerName = (skillNameById.get(id) || "").toLowerCase();
      if (!lowerName) continue;
      if (!selectedClassSkillNamesLower.has(lowerName)) continue;
      if (requiredClassSkillNamesLower.has(lowerName)) continue;
      count += 1;
    }
    return count;
  }, [build.trainedSkillIds, skillNameById, selectedClassSkillNamesLower, requiredClassSkillNamesLower]);
  const maxAdditionalTrainedSkills =
    (legality.classSkillRules?.chooseAdditionalCount ?? 0) + racialSkillTrainingSlotCount;
  const trainedSkillSelectionMaxed = trainedOptionalClassSkillCount >= maxAdditionalTrainedSkills;
  const prereqContext = useMemo(() => buildPrereqCharacterContext(index, build), [index, build]);
  const hybridPrereqOptions = useMemo(() => {
    const hybridNames = hybridBaseClassNames(index, build);
    return {
      index,
      context: prereqContext,
      additionalClassNamesForMatch: hybridNames.length ? hybridNames : undefined
    };
  }, [index, build, prereqContext]);

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

  const themeLegalityById = useMemo(() => {
    const map = new Map<string, { legal: boolean; reasons: string[] }>();
    for (const theme of themesSorted) {
      map.set(
        theme.id,
        evaluateSupportOptionLegality(theme.prereqTokens, 0, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions)
      );
    }
    return map;
  }, [themesSorted, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions]);

  const paragonLegalityById = useMemo(() => {
    const map = new Map<string, { legal: boolean; reasons: string[] }>();
    for (const path of paragonPathsSorted) {
      map.set(
        path.id,
        evaluateSupportOptionLegality(path.prereqTokens, 11, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions)
      );
    }
    return map;
  }, [paragonPathsSorted, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions]);

  const epicLegalityById = useMemo(() => {
    const map = new Map<string, { legal: boolean; reasons: string[] }>();
    for (const destiny of epicDestiniesSorted) {
      map.set(
        destiny.id,
        evaluateSupportOptionLegality(destiny.prereqTokens, 21, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions)
      );
    }
    return map;
  }, [epicDestiniesSorted, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions]);

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

  /** Which builder tab owns this validation message (for status dots and error buckets). */
  function resolveValidationErrorTab(message: string): BuilderTab | null {
    const m = message.toLowerCase();
    if (m.startsWith("theme:") || m.includes("selected theme is not")) {
      return "theme";
    }
    if (
      m.startsWith("paragon path:") ||
      m.includes("paragon path can only") ||
      m.includes("selected paragon path is not")
    ) {
      return "paragonPath";
    }
    if (
      m.startsWith("epic destiny:") ||
      m.includes("epic destiny can only") ||
      m.includes("selected epic destiny is not")
    ) {
      return "epicDestiny";
    }
    if (m === "choose a race." || m.startsWith("race:")) return "race";
    if (m === "choose a class." || m.startsWith("class:")) return "class";
    if (m.startsWith("power:")) return "powers";
    if (m.includes("hybrid class")) return "class";
    if (m.includes("hybrid talent")) return "class";
    if (m.includes("point-buy") || m.includes("ability increases")) return "abilities";
    if (m.includes("ability") || m.includes("score")) return "abilities";
    if (m.includes("trained") || m.includes("skill")) return "skills";
    if (m.includes("feat")) return "feats";
    if (m.includes("utility power")) return "powers";
    if (m.includes("at-will") || m.includes("encounter") || m.includes("daily") || m.includes("power")) return "powers";
    if (m.includes("main weapon") || m.includes("off-hand weapon") || m.includes("selected implement")) return "equipment";
    return null;
  }

  /** Tab to open when jumping from an error (respects tier locks when those tabs are hidden). */
  function navigateToTabForError(message: string): BuilderTab | null {
    const t = resolveValidationErrorTab(message);
    if (!t) return null;
    if (t === "paragonPath" && build.level < 11) return "theme";
    if (t === "epicDestiny" && build.level < 21) return build.level >= 11 ? "paragonPath" : "theme";
    return t;
  }

  const tabStatuses = useMemo(() => {
    const errorsByTab = legality.errors.reduce<Record<BuilderTab, number>>(
      (acc, e) => {
        const tab = resolveValidationErrorTab(e);
        if (tab) acc[tab] += 1;
        return acc;
      },
      {
        race: 0,
        class: 0,
        abilities: 0,
        skills: 0,
        feats: 0,
        powers: 0,
        theme: 0,
        paragonPath: 0,
        epicDestiny: 0,
        equipment: 0
      }
    );

    const classReady = isHybridBuild ? hybridClassSelectionComplete : !!selectedClass;
    const statuses: Record<BuilderTab, "complete" | "incomplete"> = {
      race: !!selectedRace && errorsByTab.race === 0 ? "complete" : "incomplete",
      class: classReady && errorsByTab.class === 0 ? "complete" : "incomplete",
      abilities:
        errorsByTab.abilities === 0 &&
        pointBuy.remaining === 0 &&
        pointBuy.invalidScores.length === 0
          ? "complete"
          : "incomplete",
      skills: classReady && errorsByTab.skills === 0 ? "complete" : "incomplete",
      feats:
        errorsByTab.feats === 0 && build.featIds.length === expectedFeatCount ? "complete" : "incomplete",
      powers: classReady && errorsByTab.powers === 0 ? "complete" : "incomplete",
      theme: !!build.themeId && errorsByTab.theme === 0 ? "complete" : "incomplete",
      paragonPath:
        errorsByTab.paragonPath === 0 &&
        (build.level < 11 || !!build.paragonPathId || build.paragonMulticlassing)
          ? "complete"
          : "incomplete",
      epicDestiny:
        errorsByTab.epicDestiny === 0 && (build.level < 21 || !!build.epicDestinyId) ? "complete" : "incomplete",
      equipment: errorsByTab.equipment === 0 ? "complete" : "incomplete"
    };
    return statuses;
  }, [
    legality.errors,
    selectedRace,
    selectedClass,
    isHybridBuild,
    hybridClassSelectionComplete,
    selectedHybridA,
    selectedHybridB,
    build.trainedSkillIds.length,
    build.featIds.length,
    build.powerIds.length,
    pointBuy.remaining,
    pointBuy.invalidScores.length,
    build.level,
    build.themeId,
    build.paragonPathId,
    build.paragonMulticlassing,
    build.epicDestinyId,
    expectedFeatCount
  ]);

  const builderTabItems = useMemo((): BuilderTabCarouselItem<BuilderTab>[] => {
    const entries: [BuilderTab, string][] = [
      ["race", "Race"],
      ["class", "Class"],
      ["abilities", "Ability Scores"],
      ["skills", "Skills"],
      ["feats", "Feats"],
      ["powers", "Powers"],
      ["theme", "Theme"],
      ...(build.level >= 11 ? ([["paragonPath", "Paragon path"]] as [BuilderTab, string][]) : []),
      ...(build.level >= 21 ? ([["epicDestiny", "Epic destiny"]] as [BuilderTab, string][]) : []),
      ["equipment", "Equipment"]
    ];
    return entries.map(([id, label]) => ({
      id,
      label,
      status: tabStatuses[id]
    }));
  }, [build.level, tabStatuses]);

  const validationIssueCount = useMemo(() => {
    const featIssueCount = featOptions
      .filter((f) => !f.legal && build.featIds.includes(f.item.id))
      .reduce((sum, f) => sum + f.reasons.length, 0);
    return legality.warnings.length + legality.errors.length + featIssueCount;
  }, [featOptions, build.featIds, legality.warnings, legality.errors]);

  function renderTabStatus(status: "complete" | "incomplete"): string {
    return status === "complete" ? "Complete" : "Incomplete";
  }

  function updateBuild(next: CharacterBuild): void {
    let pruned = pruneStalePowerSelections(index, next);
    pruned = pruneParagonMulticlassing(index, pruned);
    pruned = pruneHybridPsionicAugmentationChoices(pruned);
    const normalized = normalizeCharacterBuild(pruned, index);
    setBuild(normalized);
    saveBuild(normalized);
  }

  useEffect(() => {
    setNameDraft(build.name);
  }, [build.name]);

  function commitNameDraft(): CharacterBuild {
    if (nameDraft === build.name) return build;
    const next = { ...build, name: nameDraft };
    updateBuild(next);
    return next;
  }

  function refreshSavedCharacters(): void {
    setSavedCharacters(loadSavedCharacters());
  }

  function renderClassFeatureTraitList(rows: TraitDisplayRow[]): JSX.Element | null {
    if (rows.length === 0) return null;
    return (
      <div style={{ marginTop: "0.65rem" }}>
        <h4 style={subsectionTitleStyle}>Class features</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {rows.map((row) => {
            const feature = classFeatureById.get(row.id);
            return (
              <CollapsibleDisclosure
                key={row.id}
                style={{
                  backgroundColor: "var(--surface-1)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: "8px",
                  padding: "0.45rem 0.55rem"
                }}
                summary={
                  <>
                    {row.name}
                    {row.shortDescription ? (
                      <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> — {row.shortDescription}</span>
                    ) : null}
                  </>
                }
                summaryStyle={{
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  lineHeight: 1.4
                }}
                bodyStyle={{ marginTop: "0.4rem", fontSize: "0.86rem", lineHeight: 1.45 }}
              >
                {feature?.source && (
                  <p style={{ margin: "0 0 0.35rem 0", color: "var(--text-muted)" }}>
                    <strong>Source:</strong> {feature.source}
                  </p>
                )}
                {!feature && row.id.startsWith("ID_") && (
                  <p style={{ margin: 0, color: "var(--status-warning)" }}>
                    This feature is listed on the class but was not found in the loaded rules data ({row.id}).
                  </p>
                )}
                {feature?.body ? (
                  <RulesRichText
                    text={feature.body}
                    paragraphStyle={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}
                    listItemStyle={{ fontSize: "0.86rem", color: "var(--text-secondary)" }}
                  />
                ) : null}
              </CollapsibleDisclosure>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPowerCardWithSelections(p: Power, cardKey: string, displayPower?: Power): JSX.Element {
    const cardPower = displayPower ?? p;
    return (
      <div key={cardKey}>
        {renderPowerCard(cardPower, {
          key: `${cardKey}-card`,
          rulesIndex: index,
          keywordTooltip: powerKeywordTooltip,
          onKeywordMouseEnter: (event, keyword) => glossaryTooltipUi.startHover(event, `powerKeyword:${keyword}`),
          onKeywordMouseLeave: glossaryTooltipUi.leaveHover,
          glossaryHover: { start: glossaryTooltipUi.startHover, leave: glossaryTooltipUi.leaveHover },
          renderRuleText: renderPowerGlossaryRuleText,
          featModsByPowerId
        })}
        <PowerConstructionSelects power={p} build={build} onChange={updateBuild} />
      </div>
    );
  }

  function commitRaceTraitBundleSelection(selectionKey: string, optionTraitId: string): void {
    const next = { ...(build.raceSelections || {}) };
    if (optionTraitId) next[selectionKey] = optionTraitId;
    else delete next[selectionKey];
    const humanPowerSlot = findHumanPowerSelectionBundleSlot(selectedRace, racialTraitById);
    if (humanPowerSlot && selectionKey === humanPowerSlot.selectionKey) {
      delete next.humanPowerOption;
    }
    for (const key of Object.keys(next)) {
      if (key.startsWith("racialPower:")) delete next[key];
    }
    const keys = Object.keys(next);
    const raceSelections = keys.length ? next : undefined;
    const abilityInfo = resolveRaceAbilityBonusInfo(selectedRace, racialTraitById, raceSelections);
    let racialAbilityChoice = build.racialAbilityChoice;
    if (racialAbilityChoice && !abilityInfo.chooseOne.includes(racialAbilityChoice)) {
      racialAbilityChoice = undefined;
    }
    let nextBuild: CharacterBuild = { ...build, raceSelections, racialAbilityChoice };
    nextBuild = pruneStalePowerSelections(index, nextBuild);
    const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBuild, build.level);
    updateBuild({ ...nextBuild, classPowerSlots, powerIds });
  }

  function commitRacialTraitRuleSelection(slotKey: string, value: string): void {
    const next = { ...(build.raceSelections || {}) };
    if (value) next[slotKey] = value;
    else delete next[slotKey];
    if (slotKey.startsWith("countsAsRace:")) {
      for (const key of Object.keys(next)) {
        if (key.startsWith("racialPower:")) delete next[key];
      }
    }
    const keys = Object.keys(next);
    let nextBuild: CharacterBuild = { ...build, raceSelections: keys.length ? next : undefined };
    nextBuild = pruneStalePowerSelections(index, nextBuild);
    const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBuild, build.level);
    updateBuild({ ...nextBuild, classPowerSlots, powerIds });
  }

  function commitRacePowerSelection(traitId: string, powerId: string): void {
    const key = racePowerSelectSelectionKey(traitId);
    const prevPow = build.raceSelections?.[key];
    const next = { ...(build.raceSelections || {}) };
    if (powerId) next[key] = powerId;
    else delete next[key];
    const keys = Object.keys(next);
    let nextBuild: CharacterBuild = { ...build, raceSelections: keys.length ? next : undefined };
    if (prevPow && prevPow !== powerId && nextBuild.powerSelections?.[prevPow]) {
      const ps = { ...nextBuild.powerSelections };
      delete ps[prevPow];
      nextBuild = { ...nextBuild, powerSelections: Object.keys(ps).length ? ps : undefined };
    }
    updateBuild(nextBuild);
  }

  function commitFeatPowerReplaceToggle(
    featId: string,
    slotKey: string,
    replacementPowerId: string,
    enabled: boolean
  ): void {
    let nextBuild = build;
    if (enabled) {
      const otherFeatId = isSlotUsedByAnotherFeatSwap(build, slotKey, featId);
      if (otherFeatId) nextBuild = disableFeatPowerReplace(nextBuild, otherFeatId);
      nextBuild = enableFeatPowerReplace(nextBuild, featId, slotKey, replacementPowerId);
    } else {
      nextBuild = disableFeatPowerReplace(nextBuild, featId);
    }
    const trimmed = nextBuild.classPowerSlots;
    updateBuild({
      ...nextBuild,
      powerIds: orderedPowerIdsFromSlots(powerSlotDefs, trimmed)
    });
  }

  function commitMulticlassSlotSwapToggle(
    featId: string,
    slotKey: string,
    replacementPowerId: string,
    enabled: boolean
  ): void {
    let nextBuild = toggleMulticlassSlotSwap(build, featId, slotKey, replacementPowerId, enabled);
    const trimmed = nextBuild.classPowerSlots;
    updateBuild({
      ...nextBuild,
      powerIds: orderedPowerIdsFromSlots(powerSlotDefs, trimmed)
    });
  }

  function commitParagonAtWillSwap(slotKey: string, powerId: string): void {
    const nextBuild = setParagonAtWillSwap(build, slotKey || undefined, powerId || undefined);
    const trimmed = nextBuild.classPowerSlots;
    updateBuild({
      ...nextBuild,
      powerIds: orderedPowerIdsFromSlots(powerSlotDefs, trimmed)
    });
  }

  function commitMulticlassSlotSwapPowerChange(featId: string, replacementPowerId: string): void {
    const nextBuild = updateMulticlassSlotSwapReplacement(build, featId, replacementPowerId);
    const trimmed = nextBuild.classPowerSlots;
    updateBuild({
      ...nextBuild,
      powerIds: orderedPowerIdsFromSlots(powerSlotDefs, trimmed)
    });
  }

  function commitClassPowerSlot(slotKey: string, powerId: string): void {
    const defs = powerSlotDefs;
    let nextBase = build;
    for (const [featId, state] of Object.entries(build.featPowerReplacements || {})) {
      if (state.slotKey === slotKey) {
        nextBase = disableFeatPowerReplace(nextBase, featId);
      }
    }
    if (isSlotUsedByParagonAtWillSwap(build, slotKey)) {
      nextBase = disableParagonAtWillSwap(nextBase);
    }
    const prevId = nextBase.classPowerSlots?.[slotKey];
    const nextSlots: Record<string, string> = { ...(nextBase.classPowerSlots || {}) };
    const normalizedId = powerId ? resolveBaseAugmentablePowerId(index, powerId) : "";
    if (normalizedId) nextSlots[slotKey] = normalizedId;
    else delete nextSlots[slotKey];
    const trimmed = Object.keys(nextSlots).length ? nextSlots : undefined;
    let nextBuild: CharacterBuild = {
      ...nextBase,
      classPowerSlots: trimmed,
      powerIds: orderedPowerIdsFromSlots(defs, trimmed)
    };
    if (prevId && prevId !== normalizedId && nextBuild.powerSelections?.[prevId]) {
      const ps = { ...nextBuild.powerSelections };
      delete ps[prevId];
      nextBuild = { ...nextBuild, powerSelections: Object.keys(ps).length ? ps : undefined };
    }
    updateBuild(nextBuild);
  }

  useEffect(() => {
    if (!index) return;
    const hybrid = build.characterStyle === "hybrid";
    if (!hybrid && !build.classId) return;
    if (hybrid && (!build.hybridClassIdA || !build.hybridClassIdB)) return;

    setBuild((prev) => {
      if (prev.classPowerSlots || prev.powerIds.length === 0) return prev;
      const bonus = bonusClassAtWillSlotFromRaceBuild(index, prev);
      const hybridPrev = prev.characterStyle === "hybrid";
      let defs;
      let inferred: Record<string, string> | undefined;
      if (hybridPrev) {
        const ha = index.hybridClasses?.find((h) => h.id === prev.hybridClassIdA);
        const hb = index.hybridClasses?.find((h) => h.id === prev.hybridClassIdB);
        const ba = ha?.baseClassId ?? undefined;
        const bb = hb?.baseClassId ?? undefined;
        if (!ba || !bb) return prev;
        defs = buildHybridPowerSlotDefinitions(
          prev.level,
          bonus,
          paragonMulticlassPrimaryAtWillSlotPenalty(index, prev)
        );
        inferred = inferHybridClassPowerSlotsFromPowerIds(defs, prev.powerIds, index, ba, bb, prev.level);
      } else {
        defs = buildClassPowerSlotDefinitions(prev.level, bonus);
        inferred = inferClassPowerSlotsFromPowerIds(defs, prev.powerIds, index, prev.classId, prev.level);
      }
      if (!inferred) return prev;
      const next = { ...prev, classPowerSlots: inferred, powerIds: orderedPowerIdsFromSlots(defs, inferred) };
      saveBuild(next);
      return next;
    });
  }, [
    index,
    build.classId,
    build.characterStyle,
    build.hybridClassIdA,
    build.hybridClassIdB,
    build.level,
    build.raceId,
    build.powerIds.join(","),
    build.classPowerSlots === undefined,
    JSON.stringify(build.raceSelections ?? {})
  ]);

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
      <div style={pageHeaderRowStyle}>
        <h1 style={pageTitleStyle}>D&amp;D 4e Character Builder</h1>
        <BuilderPersistenceToolbar
          index={index}
          build={build}
          nameDraft={nameDraft}
          commitNameDraft={commitNameDraft}
          onBuildChange={updateBuild}
          savedCharacters={savedCharacters}
          onSavedCharactersChange={refreshSavedCharacters}
          activeSavedCharacterId={activeSavedCharacterId}
          onActiveSavedCharacterIdChange={setActiveSavedCharacterId}
        />
      </div>
      <div style={ui.chromeFields}>
          <label style={{ display: "block", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Character Name
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitNameDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.5rem",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                backgroundColor: "var(--surface-0)",
                boxSizing: "border-box"
              }}
            />
          </label>
          <label style={{ display: "block", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Level (1–30)
            <AdjustableNumberInput
              min={1}
              max={30}
              value={build.level}
              onChange={(lv) => {
                const milestoneKeys = new Set(requiredAsiMilestonesUpTo(lv).map(String));
                const asiNext: AsiChoices = { ...(build.asiChoices || {}) };
                for (const k of Object.keys(asiNext)) {
                  if (!milestoneKeys.has(k)) delete asiNext[k];
                }
                const maxFeats = totalFeatSlots(lv, resolveRacialFeatSlotCountForBuild(index, { ...build, level: lv }));
                const nextBase: CharacterBuild = {
                  ...build,
                  level: lv,
                  paragonPathId: lv < 11 ? undefined : build.paragonPathId,
                  epicDestinyId: lv < 21 ? undefined : build.epicDestinyId,
                  featIds: build.featIds.slice(0, maxFeats),
                  asiChoices: Object.keys(asiNext).length > 0 ? asiNext : undefined
                };
                const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, lv);
                updateBuild({ ...nextBase, classPowerSlots, powerIds });
              }}
              ariaLabel="Character level"
              style={{ marginTop: "0.25rem" }}
            />
          </label>
        </div>
      <div style={ui.stickyTabBar}>
        <BuilderTabCarousel
          tabs={builderTabItems}
          activeTab={activeTab}
          onSelect={setActiveTab}
          renderStatus={renderTabStatus}
        />
      </div>

      <div style={ui.builderBody}>
        <div
          style={{
            ...ui.bodyRow,
            display: useSingleColumnLayout ? "grid" : "flex",
            gridTemplateColumns: useSingleColumnLayout ? "minmax(0, 1fr)" : undefined
          }}
        >
        <div
          style={{
            ...ui.mainColumn,
            flex: useSingleColumnLayout ? undefined : "1 1 0",
            width: useSingleColumnLayout ? undefined : 0
          }}
        >
        {activeTab === "race" && (
          <>
            <h3 style={builderSectionTitleStyle}>Race</h3>
            <select
              value={build.raceId || ""}
              onChange={(e) => {
                const raceId = e.target.value || undefined;
                const race = raceId ? index.races.find((r) => r.id === raceId) : undefined;
                const nextBase: CharacterBuild = {
                  ...build,
                  raceId,
                  racialAbilityChoice: undefined,
                  raceSelections: undefined,
                  powerSelections: undefined
                };
                const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, build.level);
                updateBuild({ ...nextBase, classPowerSlots, powerIds });
              }}
              style={{ width: "100%" }}
            >
              <option value="">Select race</option>
              {index.races.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}
            </select>
            {selectedRace &&
              (raceTraitBundleSlots.length > 0 ||
                raceAbilityBonusInfo.fixed.length > 0 ||
                raceSecondarySlots.length > 0 ||
                racialTraitRuleSelectSlotsRaceTab.length > 0 ||
                racePowerGroups.some((g) => g.choiceOnly && !g.dilettantePick)) && (
                <div style={{ marginTop: "0.65rem", ...ui.blockSubsection, backgroundColor: "var(--surface-1)", borderColor: "var(--panel-border)" }}>
                  <h4 style={subsectionTitleStyle}>Race choices</h4>
                  {raceTraitBundleSlots.map((bundle) => {
                    const pickedId = build.raceSelections?.[bundle.selectionKey] || "";
                    const picked = bundle.options.find((o) => o.id === pickedId);
                    return (
                      <label key={bundle.selectionKey} style={{ display: "block", marginBottom: "0.75rem" }}>
                        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                          {bundle.parentTraitName}
                        </span>
                        <select
                          value={pickedId}
                          onChange={(e) => commitRaceTraitBundleSelection(bundle.selectionKey, e.target.value)}
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                        >
                          <option value="">Select…</option>
                          {bundle.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        {picked?.shortDescription && (
                          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                            {picked.shortDescription}
                          </p>
                        )}
                        {picked?.body && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            <RulesRichText text={picked.body} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                  {racePowerGroups
                    .filter((g) => g.choiceOnly && !g.dilettantePick)
                    .map((g) => {
                      const selectedPowId = build.raceSelections?.[racePowerSelectSelectionKey(g.traitId)] || "";
                      const optionPowers = g.dilettantePick
                        ? dilettanteCandidatePowers
                        : g.powerIds
                            .map((pid) => index.powers.find((p) => p.id === pid))
                            .filter((p): p is Power => !!p);
                      return (
                        <label key={`race-choice-power-${g.traitId}`} style={{ display: "block", marginBottom: "0.75rem" }}>
                          <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                            {g.traitName}
                          </span>
                          <select
                            value={selectedPowId}
                            disabled={g.dilettantePick && !classIdForDilettante}
                            onChange={(e) => commitRacePowerSelection(g.traitId, e.target.value)}
                            style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                          >
                            <option value="">Select power…</option>
                            {optionPowers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  {raceAbilityBonusInfo.fixed.length > 0 && (
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      <strong>Racial ability (+2):</strong>{" "}
                      {raceAbilityBonusInfo.fixed.map((a) => `+2 ${getAbilityLabel(a)}`).join(", ")}
                    </p>
                  )}
                  {raceDefersAbilityBonusToSubrace(selectedRace) && !build.raceSelections?.subrace && (
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Ability bonuses depend on the variant selected above (choose on the Ability Scores tab).
                    </p>
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
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
                  {racialTraitRuleSelectSlotsRaceTab.map((slot) => (
                    <label key={slot.key} style={{ display: "block", marginBottom: "0.65rem" }}>
                      <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                        {slot.label}
                      </span>
                      {slot.kind === "countsAsRace" && (
                        <select
                          value={(build.raceSelections || {})[slot.key] || ""}
                          onChange={(e) => commitRacialTraitRuleSelection(slot.key, e.target.value)}
                          style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                        >
                          <option value="">Select former race…</option>
                          {countsAsRacePickOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                </div>
              )}
            {selectedRace && (
              <div style={{ ...ui.blockSubsection, marginTop: "0.65rem" }}>
                <p style={{ margin: 0 }}><strong>Source:</strong> {selectedRace.source || "Unknown"}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Speed:</strong> {String(raceSpecific["Speed"] || selectedRace.speed || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Size:</strong> {String(raceSpecific["Size"] || selectedRace.size || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Ability Scores:</strong> {raceAbilityScoresDisplay}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Languages:</strong> {String(raceSpecific["Languages"] || selectedRace.languages || "-")}</p>
                {displayedRacialTraitRows.length > 0 && (
                  <div style={{ marginTop: "0.65rem" }}>
                    <h4 style={subsectionTitleStyle}>Racial traits</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      {displayedRacialTraitRows.map(({ id, trait }) => (
                        <CollapsibleDisclosure
                          key={id}
                          style={{
                            backgroundColor: "var(--surface-1)",
                            border: "1px solid var(--panel-border)",
                            borderRadius: "8px",
                            padding: "0.45rem 0.55rem"
                          }}
                          summary={
                            <>
                              {trait?.name || id}
                              {trait?.shortDescription ? (
                                <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> — {trait.shortDescription}</span>
                              ) : null}
                            </>
                          }
                          summaryStyle={{
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "0.88rem",
                            lineHeight: 1.4
                          }}
                          bodyStyle={{ marginTop: "0.4rem", fontSize: "0.86rem", lineHeight: 1.45 }}
                        >
                            {trait?.source && (
                              <p style={{ margin: "0 0 0.35rem 0", color: "var(--text-muted)" }}>
                                <strong>Source:</strong> {trait.source}
                              </p>
                            )}
                            {!trait && (
                              <p style={{ margin: 0, color: "var(--status-warning)" }}>
                                This trait is listed on the race but was not found in the loaded rules data ({id}).
                              </p>
                            )}
                            {trait?.body ? <RulesRichText text={trait.body} /> : null}
                        </CollapsibleDisclosure>
                      ))}
                    </div>
                  </div>
                )}
                {racePowerGroups.some((g) => g.powerIds.length > 0) && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={subsectionTitleStyle}>Granted powers</h4>
                    {racePowerGroups
                      .filter((g) => g.powerIds.length > 0)
                      .map((g) => (
                        <div key={`race-powers-${g.traitId}`} style={{ marginBottom: "0.55rem" }}>
                          <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                            <strong>{g.traitName}</strong>
                          </p>
                          <div>
                            {g.powerIds.map((pid) => {
                              const p = index.powers.find((x) => x.id === pid);
                              return p
                                ? renderPowerCard(p, {
                                    key: `race-tab-${g.traitId}-${p.id}`,
                                    rulesIndex: index,
                                    keywordTooltip: powerKeywordTooltip,
                                    onKeywordMouseEnter: (event, keyword) =>
                                      glossaryTooltipUi.startHover(event, `powerKeyword:${keyword}`),
                                    onKeywordMouseLeave: glossaryTooltipUi.leaveHover,
                                    glossaryHover: { start: glossaryTooltipUi.startHover, leave: glossaryTooltipUi.leaveHover },
                                    renderRuleText: renderPowerGlossaryRuleText,
                                    featModsByPowerId
                                  })
                                : (
                                  <p key={pid} style={{ margin: 0, fontSize: "0.82rem", color: "var(--status-warning)" }}>
                                    Stored power id is unknown in the index.
                                  </p>
                                );
                            })}
                          </div>
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
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.5rem" }}
          summary="Lore Overview"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(selectedRace.raw.body)} />
        </CollapsibleDisclosure>
                )}
                {raceSpecific["Physical Qualities"] && (
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.4rem" }}
          summary="Physical Qualities"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(raceSpecific["Physical Qualities"])} />
        </CollapsibleDisclosure>
                )}
                {raceSpecific["Playing"] && (
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.4rem" }}
          summary="Playing This Race"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(raceSpecific["Playing"])} />
        </CollapsibleDisclosure>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "class" && (
          <div>
            <h3 style={builderSectionTitleStyle}>Class</h3>
            <div style={{ marginBottom: "0.65rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: "0.88rem", cursor: "pointer", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="radio"
                  name="characterStyle"
                  checked={!isHybridBuild}
                  onChange={() =>
                    updateBuild({
                      ...build,
                      characterStyle: undefined,
                      hybridClassIdA: undefined,
                      hybridClassIdB: undefined,
                      hybridTalentClassFeatureIdA: undefined,
                      hybridTalentClassFeatureIdB: undefined,
                      hybridSideASelections: undefined,
                      hybridSideBSelections: undefined,
                      powerIds: [],
                      classPowerSlots: undefined
                    })
                  }
                />
                Standard class
              </label>
              <label style={{ fontSize: "0.88rem", cursor: "pointer", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                <input
                  type="radio"
                  name="characterStyle"
                  checked={isHybridBuild}
                  onChange={() =>
                    updateBuild({
                      ...build,
                      characterStyle: "hybrid",
                      classId: undefined,
                      classSelections: undefined,
                      hybridTalentClassFeatureIdA: undefined,
                      hybridTalentClassFeatureIdB: undefined,
                      hybridSideASelections: undefined,
                      hybridSideBSelections: undefined,
                      powerIds: [],
                      classPowerSlots: undefined
                    })
                  }
                />
                Hybrid (PHB3)
              </label>
            </div>

            {!isHybridBuild && (
              <select
                value={build.classId || ""}
                onChange={(e) => {
                  const classId = e.target.value || undefined;
                  const nextBase: CharacterBuild = {
                    ...build,
                    classId,
                    classSelections: undefined,
                    powerIds: [],
                    classPowerSlots: undefined
                  };
                  const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, build.level);
                  updateBuild({ ...nextBase, classPowerSlots, powerIds });
                }}
                style={{ width: "100%" }}
              >
                <option value="">Select class</option>
                {classesForSelect.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            )}

            {isHybridBuild && (
              <>
                <div
                  style={{
                    display: "grid",
                    gap: "0.85rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    alignItems: "start"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", minWidth: 0 }}>
                    <label style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}>
                      First hybrid class
                      <select
                        value={build.hybridClassIdA || ""}
                        onChange={(e) => {
                          const hybridClassIdA = e.target.value || undefined;
                          const nextBase: CharacterBuild = {
                            ...build,
                            characterStyle: "hybrid",
                            hybridClassIdA,
                            hybridTalentClassFeatureIdA: undefined,
                            hybridSideASelections: undefined,
                            classId: undefined,
                            classSelections: undefined
                          };
                          const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, build.level);
                          updateBuild({ ...nextBase, classPowerSlots, powerIds });
                        }}
                        style={{
                          width: "100%",
                          marginTop: "0.25rem",
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: "1px solid var(--panel-border)",
                          boxSizing: "border-box"
                        }}
                      >
                        <option value="">Select hybrid class…</option>
                        {hybridClassesForHybridSelect
                          .filter((h) => h.id !== build.hybridClassIdB)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedHybridA?.hybridTalentClassFeatures && selectedHybridA.hybridTalentClassFeatures.length > 0 && (
                      <label style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}>
                        Hybrid talent
                        <select
                          value={build.hybridTalentClassFeatureIdA || ""}
                          onChange={(e) =>
                            updateBuild({
                              ...build,
                              hybridTalentClassFeatureIdA: e.target.value || undefined
                            })
                          }
                          style={{
                            width: "100%",
                            marginTop: "0.25rem",
                            padding: "0.4rem",
                            borderRadius: "6px",
                            border: "1px solid var(--panel-border)",
                            boxSizing: "border-box"
                          }}
                        >
                          <option value="">— Choose hybrid talent —</option>
                          {selectedHybridA.hybridTalentClassFeatures.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const sel = selectedHybridA.hybridTalentClassFeatures.find(
                            (o) => o.id === build.hybridTalentClassFeatureIdA
                          );
                          return sel?.shortDescription ? (
                            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                              {sel.shortDescription}
                            </p>
                          ) : null;
                        })()}
                      </label>
                    )}
                    {selectedHybridA?.hybridSelectionGroups?.map((g) => (
                      <label
                        key={`hyA-${g.key}`}
                        style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}
                      >
                        {g.label}
                        <select
                          value={build.hybridSideASelections?.[g.key] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const prev = build.hybridSideASelections ?? {};
                            const next: Record<string, string> = { ...prev };
                            if (v) next[g.key] = v;
                            else delete next[g.key];
                            updateBuild({
                              ...build,
                              hybridSideASelections: Object.keys(next).length > 0 ? next : undefined
                            });
                          }}
                          style={{
                            width: "100%",
                            marginTop: "0.25rem",
                            padding: "0.4rem",
                            borderRadius: "6px",
                            border: "1px solid var(--panel-border)",
                            boxSizing: "border-box"
                          }}
                        >
                          <option value="">— Choose —</option>
                          {g.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const sel = g.options.find((o) => o.id === build.hybridSideASelections?.[g.key]);
                          return sel?.shortDescription ? (
                            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                              {sel.shortDescription}
                            </p>
                          ) : null;
                        })()}
                      </label>
                    ))}
                    {selectedHybridA && (
                      <HybridClassDetailPanel
                        hybrid={selectedHybridA}
                        baseClassName={hybridBaseClassDefA?.name}
                        slotNote="Side A — at-will slot A uses this entry’s base class power list."
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", minWidth: 0 }}>
                    <label style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}>
                      Second hybrid class
                      <select
                        value={build.hybridClassIdB || ""}
                        onChange={(e) => {
                          const hybridClassIdB = e.target.value || undefined;
                          const nextBase: CharacterBuild = {
                            ...build,
                            characterStyle: "hybrid",
                            hybridClassIdB,
                            hybridTalentClassFeatureIdB: undefined,
                            hybridSideBSelections: undefined,
                            classId: undefined,
                            classSelections: undefined
                          };
                          const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, build.level);
                          updateBuild({ ...nextBase, classPowerSlots, powerIds });
                        }}
                        style={{
                          width: "100%",
                          marginTop: "0.25rem",
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: "1px solid var(--panel-border)",
                          boxSizing: "border-box"
                        }}
                      >
                        <option value="">Select hybrid class…</option>
                        {hybridClassesForHybridSelect
                          .filter((h) => h.id !== build.hybridClassIdA)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedHybridB?.hybridTalentClassFeatures && selectedHybridB.hybridTalentClassFeatures.length > 0 && (
                      <label style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}>
                        Hybrid talent
                        <select
                          value={build.hybridTalentClassFeatureIdB || ""}
                          onChange={(e) =>
                            updateBuild({
                              ...build,
                              hybridTalentClassFeatureIdB: e.target.value || undefined
                            })
                          }
                          style={{
                            width: "100%",
                            marginTop: "0.25rem",
                            padding: "0.4rem",
                            borderRadius: "6px",
                            border: "1px solid var(--panel-border)",
                            boxSizing: "border-box"
                          }}
                        >
                          <option value="">— Choose hybrid talent —</option>
                          {selectedHybridB.hybridTalentClassFeatures.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const sel = selectedHybridB.hybridTalentClassFeatures.find(
                            (o) => o.id === build.hybridTalentClassFeatureIdB
                          );
                          return sel?.shortDescription ? (
                            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                              {sel.shortDescription}
                            </p>
                          ) : null;
                        })()}
                      </label>
                    )}
                    {selectedHybridB?.hybridSelectionGroups?.map((g) => (
                      <label
                        key={`hyB-${g.key}`}
                        style={{ display: "block", margin: 0, fontSize: "0.88rem", fontWeight: 600 }}
                      >
                        {g.label}
                        <select
                          value={build.hybridSideBSelections?.[g.key] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const prev = build.hybridSideBSelections ?? {};
                            const next: Record<string, string> = { ...prev };
                            if (v) next[g.key] = v;
                            else delete next[g.key];
                            updateBuild({
                              ...build,
                              hybridSideBSelections: Object.keys(next).length > 0 ? next : undefined
                            });
                          }}
                          style={{
                            width: "100%",
                            marginTop: "0.25rem",
                            padding: "0.4rem",
                            borderRadius: "6px",
                            border: "1px solid var(--panel-border)",
                            boxSizing: "border-box"
                          }}
                        >
                          <option value="">— Choose —</option>
                          {g.options.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const sel = g.options.find((o) => o.id === build.hybridSideBSelections?.[g.key]);
                          return sel?.shortDescription ? (
                            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                              {sel.shortDescription}
                            </p>
                          ) : null;
                        })()}
                      </label>
                    ))}
                    {selectedHybridB && (
                      <HybridClassDetailPanel
                        hybrid={selectedHybridB}
                        baseClassName={hybridBaseClassDefB?.name}
                        slotNote="Side B — at-will slot B uses this entry’s base class power list."
                      />
                    )}
                  </div>
                </div>
                <p style={{ margin: "0.65rem 0 0.65rem 0", fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                  Powers use each hybrid&apos;s <strong>base class</strong> lists (shown below). Pick two different hybrid entries.
                </p>
                {hybridClassSelectionComplete && renderClassFeatureTraitList(classTraitRows)}
                {hybridClassSelectionComplete && classAutoGrantedPowers.length > 0 && (
                  <div
                    style={{
                      ...ui.blockSubsection,
                      marginTop: "0.35rem",
                      paddingTop: "0.65rem",
                      borderTop: "1px solid var(--panel-border)"
                    }}
                  >
                    <h4 style={subsectionTitleStyle}>Granted powers (both base classes)</h4>
                    {classAutoGrantedPowers.map((p) => renderPowerCardWithSelections(p, `hybrid-class-tab-${p.id}`))}
                  </div>
                )}
              </>
            )}

            {selectedClass && (
              <div style={{ ...ui.blockSubsection, marginTop: "0.65rem" }}>
                <p style={{ margin: 0 }}><strong>Role:</strong> {String(classSpecific["Role"] || selectedClass.role || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Power Source:</strong> {String(classSpecific["Power Source"] || selectedClass.powerSource || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Key Abilities:</strong> {String(classSpecific["Key Abilities"] || selectedClass.keyAbilities || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Hit Points at 1st Level:</strong> {String(classSpecific["Hit Points at 1st Level"] || selectedClass.hitPointsAt1 || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Class Skills:</strong> {String(classSpecific["Class Skills"] || "-")}</p>
                {renderClassFeatureTraitList(classTraitRows)}
                {selectedClass.raw.flavor && (
                  <p style={{ margin: "0.5rem 0 0 0" }}>
                    <strong>Flavor:</strong> {String(selectedClass.raw.flavor)}
                  </p>
                )}
                {selectedClass.raw.body && (
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.5rem" }}
          summary="Class Lore Overview"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(selectedClass.raw.body)} />
        </CollapsibleDisclosure>
                )}
                {classSpecific["Build Options"] && (
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.4rem" }}
          summary="Build Options"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(classSpecific["Build Options"])} />
        </CollapsibleDisclosure>
                )}
                {classAutoGrantedPowers.length > 0 && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={subsectionTitleStyle}>Granted powers</h4>
                    {classAutoGrantedPowers.map((p) => renderPowerCardWithSelections(p, `class-tab-${p.id}`))}
                  </div>
                )}
                {visibleClassFeatureChoiceGroups.length > 0 && (
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--panel-border)" }}>
                    <h4 style={subsectionTitleStyle}>Class choices</h4>
                    {visibleClassFeatureChoiceGroups.map((group) => {
                      const rs = build.classSelections || {};
                      if (group.kind === "classFeature") {
                        const pickedId = rs[group.key] || "";
                        const picked = group.options.find((o) => o.id === pickedId);
                        return (
                          <label key={group.key} style={{ display: "block", maxWidth: "28rem", marginBottom: "0.75rem" }}>
                            <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                              {group.parentFeatureName}
                            </span>
                            <select
                              value={pickedId}
                              onChange={(e) => {
                                const v = e.target.value;
                                let next = { ...rs };
                                if (v) next[group.key] = v;
                                else delete next[group.key];
                                next = pruneHiddenClassFeatureSelections(next, classFeatureChoiceGroups);
                                const keys = Object.keys(next);
                                updateBuild({ ...build, classSelections: keys.length ? next : undefined });
                              }}
                              style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                            >
                              <option value="">Select…</option>
                              {group.options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                            {picked?.shortDescription && (
                              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                {picked.shortDescription}
                              </p>
                            )}
                            {picked?.body && (
                              <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                                <RulesRichText text={picked.body} />
                              </div>
                            )}
                          </label>
                        );
                      }
                      const cantripPicks = parseClassPowerChoiceSelection(rs[group.key]);
                      const powerById = new Map(index.powers.map((p) => [p.id, p]));
                      return (
                        <div key={group.key} style={{ marginBottom: "0.75rem", maxWidth: "28rem" }}>
                          <span style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.85rem" }}>
                            {group.parentFeatureName} ({group.pickCount} picks)
                          </span>
                          {Array.from({ length: group.pickCount }, (_, slot) => {
                            const selectedId = cantripPicks[slot] || "";
                            const usedElsewhere = new Set(
                              cantripPicks.filter((_, i) => i !== slot)
                            );
                            return (
                              <label key={`${group.key}-${slot}`} style={{ display: "block", marginBottom: "0.35rem" }}>
                                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Pick {slot + 1}</span>
                                <select
                                  value={selectedId}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const nextPicks = [...cantripPicks];
                                    while (nextPicks.length < group.pickCount) nextPicks.push("");
                                    nextPicks[slot] = v;
                                    const filtered = nextPicks.filter(Boolean);
                                    let next = { ...rs };
                                    if (filtered.length) next[group.key] = formatClassPowerChoiceSelection(filtered);
                                    else delete next[group.key];
                                    next = pruneHiddenClassFeatureSelections(next, classFeatureChoiceGroups);
                                    updateBuild({
                                      ...build,
                                      classSelections: Object.keys(next).length ? next : undefined
                                    });
                                  }}
                                  style={{
                                    width: "100%",
                                    marginTop: "0.2rem",
                                    padding: "0.4rem",
                                    borderRadius: "6px",
                                    border: "1px solid var(--panel-border)"
                                  }}
                                >
                                  <option value="">Select power…</option>
                                  {group.powerIds.map((pid) => {
                                    const p = powerById.get(pid);
                                    if (!p || (usedElsewhere.has(pid) && pid !== selectedId)) return null;
                                    return (
                                      <option key={pid} value={pid}>
                                        {p.name}
                                      </option>
                                    );
                                  })}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {classSpecific["Role"] && (
                  <CollapsibleDisclosure
          open
          style={{ marginTop: "0.4rem" }}
          summary="Role Details"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(classSpecific["Role"])} />
        </CollapsibleDisclosure>
                )}
              </div>
            )}

          </div>
        )}

        {activeTab === "abilities" && (
          <div>
            <h3 style={builderSectionTitleStyle}>Ability Scores</h3>

            <div
              style={{
                display: "grid",
                gap: "0.85rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                alignItems: "start",
                marginBottom: "0.85rem"
              }}
            >
              <div
                style={{
                  ...ui.blockSubsection,
                  minWidth: 0,
                  backgroundColor: "var(--surface-1)",
                  borderColor: "var(--panel-border)"
                }}
              >
                <ScoreBreakdownTable
                  variant="stat"
                  columns={BUILDER_ABILITY_SCORE_COLUMNS}
                  labelHeader={null}
                  prioritizeLabel
                  compact
                  rows={builderAbilityScoreRows}
                  renderLabel={renderBuilderAbilityLabel}
                  renderComponentCell={renderBuilderAbilityComponent}
                  formatComponentValue={(row, columnKey) =>
                    columnKey === "score" ? String(row.values.score ?? "") : ""
                  }
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", minWidth: 0 }}>
                <section style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)", borderColor: "var(--panel-border)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Point buy</span>
                    <AdjustableNumberInput
                      compact
                      min={0}
                      max={60}
                      fractionLeading={pointBuy.total}
                      fractionLeadingStyle={{
                        color:
                          pointBuy.total === pointBuy.budget ? "var(--status-success)" : "var(--status-danger)"
                      }}
                      value={pointBuy.budget}
                      onChange={(next) => updateBuild({ ...build, pointBuyBudget: next })}
                      ariaLabel="Point buy"
                    />
                  </div>
                  {pointBuy.invalidScores.length > 0 && (
                    <p style={{ color: "var(--status-danger)", margin: "0.5rem 0 0 0", fontSize: "0.82rem", lineHeight: 1.35 }}>
                      Each score must be 8–18: {pointBuy.invalidScores.join(", ")}
                    </p>
                  )}
                </section>

            {(raceAbilityBonusInfo.fixed.length > 0 || raceAbilityBonusInfo.chooseOne.length > 0) && (
              <div
                style={{
                  ...ui.blockSubsection,
                  backgroundColor: "var(--surface-1)",
                  fontSize: "0.88rem"
                }}
              >
                <p style={{ margin: 0, fontWeight: 700 }}>Racial Bonus</p>
                {raceAbilityBonusInfo.fixed.length > 0 && (
                  <p style={{ margin: "0.3rem 0 0 0" }}>
                    {raceAbilityBonusInfo.fixed.map((a) => `+2 ${getAbilityLabel(a)}`).join(", ")}
                  </p>
                )}
                {raceAbilityBonusInfo.chooseOne.length > 0 &&
                  (!raceDefersAbilityBonusToSubrace(selectedRace) || !!build.raceSelections?.subrace) && (
                  <label
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      alignItems: "center",
                      marginTop: raceAbilityBonusInfo.fixed.length > 0 ? "0.35rem" : 0
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "0.88rem", flexShrink: 0 }}>+2</span>
                    <select
                      value={build.racialAbilityChoice || ""}
                      onChange={(e) =>
                        updateBuild({ ...build, racialAbilityChoice: (e.target.value || undefined) as CharacterBuild["racialAbilityChoice"] })
                      }
                      style={{ flex: 1, minWidth: "8rem", maxWidth: "28rem", padding: "0.4rem" }}
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
                {raceDefersAbilityBonusToSubrace(selectedRace) && !build.raceSelections?.subrace && raceAbilityBonusInfo.chooseOne.length === 0 && (
                  <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Select a race variant on the Race tab to unlock the +2 ability choice.
                  </p>
                )}
              </div>
            )}
                {(build.level >= 11 || build.level >= 21) && (
                  <section style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)" }}>
                    {build.level >= 11 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          alignItems: "center",
                          marginBottom: build.level >= 21 ? "0.55rem" : 0
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Paragon Tier</span>
                        <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>All ability scores +1</span>
                      </div>
                    )}
                    {build.level >= 21 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Epic Tier</span>
                        <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>All ability scores +1</span>
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", minWidth: 0 }}>
                {requiredAsiMilestonesUpTo(build.level).length > 0 && (
                  <section style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)" }}>
                    <h4 style={subsectionTitleStyle}>Level-up ability increases</h4>
                    {requiredAsiMilestonesUpTo(build.level).map((m) => {
                      const pick = build.asiChoices?.[String(m)];
                      const otherAbilities = (a: Ability) => abilities.filter((x) => x !== a);
                      return (
                        <div
                          key={m}
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                            alignItems: "center",
                            marginBottom: "0.85rem"
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", flexShrink: 0 }}>Level {m}</span>
                            <select
                              aria-label={`Level ${m} first ability increase`}
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
                              style={{ fontSize: "0.82rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                            >
                              <option value="">—</option>
                              {abilities.map((a) => (
                                <option key={`${m}-a-${a}`} value={a}>
                                  {getAbilityLabel(a)}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label={`Level ${m} second ability increase`}
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
                              style={{ fontSize: "0.82rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                            >
                              <option value="">—</option>
                              {abilities.map((a) => (
                                <option key={`${m}-b-${a}`} value={a}>
                                  {getAbilityLabel(a)}
                                </option>
                              ))}
                            </select>
                        </div>
                      );
                    })}
                  </section>
                )}

              </div>
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div>
            <h3 style={builderSectionTitleStyle}>Skills</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.45 }}>
              All skills are listed. You can only <strong>train</strong> skills from your class list (checkbox enabled). Other skills are shown for reference.
              {racialSkillTrainingSlotCount > 0 ? (
                <>
                  {" "}
                  Your race grants {racialSkillTrainingSlotCount} extra trained class skill
                  {racialSkillTrainingSlotCount === 1 ? "" : "s"} included in the count below.
                </>
              ) : null}
            </p>
            {(isHybridBuild ? !hybridClassSelectionComplete : !selectedClass) && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                {isHybridBuild ? "Choose two hybrid classes on the Class tab to enable training choices." : "Choose a class on the Class tab to enable training choices."}
              </p>
            )}
            {(isHybridBuild ? hybridClassSelectionComplete : !!selectedClass) && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                Trained class skills:{" "}
                <strong>
                  {trainedOptionalClassSkillCount} / {maxAdditionalTrainedSkills}
                </strong>
              </p>
            )}
            <div style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)" }}>
              <ScoreBreakdownTable
                variant="skill"
                columns={SKILL_BREAKDOWN_COLUMNS}
                rows={skillRowsToBreakdown(skillSheetRows)}
                rowStripe={false}
                fontSize="0.76rem"
                formatTotalValue={(row) => formatSkillBreakdownTotal(skillRowMap(skillSheetRows).get(row.rowKey)!)}
                formatComponentValue={(row, columnKey) =>
                  formatSkillBreakdownComponent(skillRowMap(skillSheetRows).get(row.rowKey)!, columnKey)
                }
                renderLabel={(row, stripe) => {
                  const skillRow = skillRowMap(skillSheetRows).get(row.rowKey)!;
                  const skill = skillsSortedAll.find((s) => s.id === skillRow.skillId);
                  if (!skill) return skillRow.name;
                  const checked = build.trainedSkillIds.includes(skill.id);
                  const trainable = !!(selectedClass && selectedClassSkillNamesLower.has(skill.name.toLowerCase()));
                  const autoGranted = autoGrantedSkillIdSet.has(skill.id);
                  const requiredSkill = requiredClassSkillNamesLower.has(skill.name.toLowerCase());
                  const disableBecauseMaxed = trainedSkillSelectionMaxed && !checked && trainable && !requiredSkill;
                  const canInteract = (trainable || checked) && !autoGranted && !disableBecauseMaxed;
                  return (
                    <label
                      className="score-breakdown-table__label-affordance"
                      style={{
                        cursor: canInteract ? "pointer" : "default",
                        fontWeight: trainable || checked ? 600 : 400,
                        padding: "0.12rem 0.2rem",
                        borderRadius: "0.2rem",
                        backgroundColor: stripe,
                        minWidth: 0,
                        opacity: trainable || checked ? (disableBecauseMaxed ? 0.58 : 1) : 0.72
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canInteract}
                        onChange={(e) => {
                          if (e.target.checked && !trainable) return;
                          const next = e.target.checked
                            ? [...build.trainedSkillIds, skill.id]
                            : build.trainedSkillIds.filter((id) => id !== skill.id);
                          updateBuild({ ...build, trainedSkillIds: next });
                        }}
                      />
                      <SkillModifierNameContent
                        row={skillRow}
                        {...glossaryTooltipUi.hoverA11y(`skill:${skill.id}`)}
                        trailing={
                          <>
                            {autoGranted ? (
                              <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", color: "var(--status-success)", fontWeight: 600 }}>auto</span>
                            ) : null}
                            {!trainable && selectedClass ? (
                              <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", color: "var(--text-muted)" }}>off-list</span>
                            ) : null}
                          </>
                        }
                      />
                    </label>
                  );
                }}
              />
              {skillsSortedAll.map((skill) => {
                const skillBody = typeof skill.raw?.body === "string" ? skill.raw.body : "";
                if (!skillBody) return null;
                return (
                  <CollapsibleDisclosure
                    key={`${skill.id}-desc`}
                    open
                    style={{ margin: "0.25rem 0 0.35rem 1.25rem" }}
                    summary={`${skill.name} — description`}
                    summaryStyle={disclosureSummaryStyle}
                    bodyStyle={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0", color: "var(--text-secondary)" }}
                  >
                      <RulesRichText text={skillBody} paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-secondary)" }} listItemStyle={{ fontSize: "0.8rem", color: "var(--text-secondary)" }} />
                  </CollapsibleDisclosure>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "feats" && (
          <div>
            <h3 style={builderSectionTitleStyle}>Feats</h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.65rem 1.1rem",
                marginBottom: "0.5rem"
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.88rem", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={showInvalidFeats}
                  onChange={(e) => setShowInvalidFeats(e.target.checked)}
                />
                Show invalid feats
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.88rem", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={featFilterAllText}
                  onChange={(e) => setFeatFilterAllText(e.target.checked)}
                />
                Filter all text
              </label>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "0.5rem 0.75rem",
                marginBottom: "0.55rem"
              }}
            >
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", flex: "1 1 14rem", minWidth: "14rem", maxWidth: "28rem" }}>
                Filter
                <input
                  type="text"
                  value={featSearch}
                  onChange={(e) => setFeatSearch(e.target.value)}
                  placeholder="Feat name…"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "0.2rem",
                    padding: "0.4rem 0.5rem",
                    border: "1px solid var(--panel-border)",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <FeatFacetMultiSelect
                label="Tier"
                options={FEAT_TIER_OPTIONS}
                selected={featTierFilter}
                onChange={setFeatTierFilter}
                allLabel="All tiers"
                summaryPrefix="Tier"
                minWidth="8.5rem"
                detailsName="feat-facet-filters"
              />
              <FeatFacetMultiSelect
                label="Category"
                options={featCategoryOptions.map((cat) => ({ value: cat, label: cat }))}
                selected={featCategoryFilter}
                onChange={setFeatCategoryFilter}
                allLabel="All categories"
                summaryPrefix="Category"
                minWidth="10rem"
                detailsName="feat-facet-filters"
              />
              <FeatSourceFilterDropdown
                sources={featSourceOptions}
                value={featSourceFilter}
                onChange={setFeatSourceFilter}
                minWidth="10rem"
                detailsName="feat-facet-filters"
              />
              <button
                type="button"
                onClick={() => {
                  setFeatTierFilter([]);
                  setFeatCategoryFilter([]);
                  setFeatSourceFilter(EMPTY_FEAT_SOURCE_FILTER);
                }}
                style={{
                  padding: "0.35rem 0.65rem",
                  borderRadius: "6px",
                  border: "1px solid var(--panel-border)",
                  background: "var(--surface-0)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  flexShrink: 0
                }}
              >
                Clear filters
              </button>
            </div>
            <div style={{ ...ui.blockSubsection, maxHeight: "280px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
              {filteredFeatRows.length === 0 ? (
                <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  {allLegalFeats.length === 0 && !showInvalidFeats
                    ? "No feats are legal for this build yet. Check prerequisites (ability scores, race, class, skills), or turn on “Show invalid feats” to browse others."
                    : "No feats match this filter. Clear the filter or try different text."}
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredFeatRows.map((opt) => {
                    const selected = build.featIds.includes(opt.item.id);
                    const invalid = !opt.legal;
                    const atCap = !selected && build.featIds.length >= expectedFeatCount;
                    const featDisplayTags = getFeatDisplayTags(opt.item);
                    const featRaw = opt.item.raw as Record<string, unknown>;
                    const featSpecific = (featRaw.specific as Record<string, unknown> | undefined) || {};
                    const shortDescription =
                      (typeof opt.item.shortDescription === "string" && opt.item.shortDescription.trim()) ||
                      (typeof featSpecific["Short Description"] === "string" && String(featSpecific["Short Description"]).trim()) ||
                      "";
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
                            border: selected ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
                            background: invalid ? "var(--surface-2)" : selected ? "var(--surface-2)" : "var(--surface-0)",
                            cursor: invalid || atCap ? "not-allowed" : "pointer",
                            fontSize: "0.88rem",
                            opacity: invalid ? 0.92 : 1
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                              width: "100%"
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500, minWidth: 0 }}>
                              {opt.item.name}
                              {invalid && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--status-warning)" }}>Invalid</span>
                              )}
                            </span>
                            {(featDisplayTags.length > 0 || opt.item.source) && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  flexWrap: "wrap",
                                  justifyContent: "flex-start",
                                  alignItems: "baseline",
                                  gap: "0.25rem 0.5rem",
                                  flexShrink: 0,
                                  marginLeft: "auto"
                                }}
                              >
                                {featDisplayTags.map((tag) => (
                                  <FeatTagPill key={tag} tag={tag} />
                                ))}
                                {opt.item.source ? (
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400, whiteSpace: "nowrap" }}>
                                    {opt.item.source}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </span>
                          {shortDescription && (
                            <span style={{ display: "block", marginTop: "0.16rem", fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 400, lineHeight: 1.35 }}>
                              {shortDescription}
                            </span>
                          )}
                          {invalid && opt.reasons.length > 0 && (
                            <span style={{ display: "block", fontSize: "0.72rem", color: "var(--status-warning)", marginTop: "0.15rem", fontWeight: 400 }}>
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
            <div style={{ ...ui.blockSubsection, marginTop: "0.75rem", backgroundColor: "var(--surface-1)" }}>
              <div
                style={{
                  margin: 0,
                  marginBottom: "0.3rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--text-secondary)"
                }}
              >
                <strong
                  style={{
                    color:
                      build.featIds.length === expectedFeatCount
                        ? "var(--status-success)"
                        : "var(--status-danger)"
                  }}
                >
                  {build.featIds.length}
                </strong>
                <strong style={{ color: "var(--text-muted)" }}> / {expectedFeatCount}</strong>{" "}
                Selected Feats
                {racialFeatSlotCount > 0 ? (
                  <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                    {" "}
                    (includes {racialFeatSlotCount} racial bonus feat{racialFeatSlotCount === 1 ? "" : "s"}).
                  </span>
                ) : null}
              </div>
              {selectedFeats.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-muted)" }}>No feats selected yet.</p>
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
                    const featDisplayTags = getFeatDisplayTags(f);
                    const removeFeatButtonStyle = {
                      fontSize: "0.72rem",
                      lineHeight: 1.1,
                      padding: "0.16rem 0.4rem",
                      borderRadius: "999px",
                      border: "1px solid var(--status-danger)",
                      backgroundColor: "var(--surface-0)",
                      color: "var(--status-danger)",
                      cursor: "pointer",
                      fontWeight: 700,
                      flexShrink: 0
                    } as const;
                    const removeFeatButton = (
                      <button
                        type="button"
                        onClick={() => updateBuild({ ...build, featIds: build.featIds.filter((id) => id !== f.id) })}
                        style={removeFeatButtonStyle}
                        aria-label={`Remove feat ${f.name}`}
                        title="Remove feat"
                      >
                        Remove
                      </button>
                    );
                    return (
                      <article
                        key={f.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          border: "1px solid var(--panel-border)",
                          borderRadius: "8px",
                          backgroundColor: "var(--surface-0)",
                          padding: "0.45rem 0.55rem"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            width: "100%"
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "var(--text-primary)", minWidth: 0 }}>
                            {f.name}
                          </div>
                          {(featDisplayTags.length > 0 || f.source) && (
                            <span
                              style={{
                                display: "inline-flex",
                                flexWrap: "wrap",
                                justifyContent: "flex-start",
                                alignItems: "baseline",
                                gap: "0.25rem 0.5rem",
                                flexShrink: 0,
                                marginLeft: "auto"
                              }}
                            >
                              {featDisplayTags.map((tag) => (
                                <FeatTagPill key={tag} tag={tag} />
                              ))}
                              {f.source ? (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{f.source}</span>
                              ) : null}
                            </span>
                          )}
                        </div>
                        {summary ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "flex-start",
                              gap: "0.5rem",
                              marginTop: "0.28rem"
                            }}
                          >
                            <div
                              style={{
                                flex: "1 1 0",
                                minWidth: 0,
                                color: "var(--text-secondary)",
                                fontSize: "0.79rem",
                                lineHeight: 1.4
                              }}
                            >
                              {summary}
                            </div>
                            <span style={{ marginLeft: "auto" }}>{removeFeatButton}</span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.35rem" }}>{removeFeatButton}</div>
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
            <h3 style={builderSectionTitleStyle}>Power Selection</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
              Each <strong>class</strong> slot is a separate choice. The list for a slot only includes <strong>class</strong> powers whose{" "}
              <strong>printed level</strong> is at most that slot&apos;s gain level (for example, the 3rd-level encounter slot only lists encounter
              attacks of printed level 3 or lower). Search filters the lists. Paragon path and epic destiny powers are shown below when you have
              selected them on their tabs; they are extra powers on top of your class schedule, not chosen into these class slots.
            </p>
            {legality.powerSlotRules && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <strong>Required for level {build.level}:</strong> {legality.powerSlotRules.atWill} at-will attack,{" "}
                {legality.powerSlotRules.encounter} encounter attack, {legality.powerSlotRules.daily} daily attack,{" "}
                {legality.powerSlotRules.utility} utility.
              </p>
            )}
            {upcomingPowerSlotMilestones.length > 0 && (
              <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                <strong>Next class slots (PHB schedule):</strong>{" "}
                {upcomingPowerSlotMilestones.map((m) => `${m.label} at level ${m.atLevel}`).join("; ")}.
              </p>
            )}
            {(racePowerGroups.some((g) => g.powerIds.length > 0) ||
              dilettantePowerGroups.length > 0 ||
              classAutoGrantedPowers.length > 0 ||
              featGrantedPowers.length > 0 ||
              featPowerReplaceRows.length > 0 ||
              multiclassSlotSwapRows.length > 0 ||
              featModifiedPowers.length > 0 ||
              featClassFeatureModifications.length > 0 ||
              themeGrantedPowers.length > 0 ||
              paragonPathGrantedPowers.length > 0 ||
              paragonMcGrantedPowers.length > 0 ||
              epicDestinyGrantedPowers.length > 0) && (
              <section style={{ marginBottom: "1.1rem", padding: "0.65rem 0.75rem", backgroundColor: "var(--surface-1)", borderRadius: "8px", border: "1px solid var(--panel-border)" }}>
                {racePowerGroups.some((g) => g.powerIds.length > 0) && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div>
                      {racePowerGroups
                        .filter((g) => g.powerIds.length > 0)
                        .map((g) => (
                          <div key={g.traitId} style={{ marginBottom: "0.35rem" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>{g.traitName}</span>
                            <div style={{ marginTop: "0.2rem" }}>
                              {g.powerIds.map((pid) => {
                                const p = index.powers.find((x) => x.id === pid);
                                return p ? renderPowerCardWithSelections(p, `race-${g.traitId}-${p.id}`) : <div key={pid}>{pid}</div>;
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {classAutoGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Class</div>
                    <div>
                      {classAutoGrantedPowers.map((p) => renderPowerCardWithSelections(p, `class-${p.id}`))}
                    </div>
                  </div>
                )}
                {themeGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Theme{selectedTheme ? ` — ${selectedTheme.name}` : ""}
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Granted by your theme when you meet each power&apos;s level; not chosen into class slots above.
                    </p>
                    <div>{themeGrantedPowers.map((p) => renderPowerCardWithSelections(p, `theme-${p.id}`))}</div>
                  </div>
                )}
                {paragonPathGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Paragon path{selectedParagonPath ? ` — ${selectedParagonPath.name}` : ""}
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Granted when your level reaches each power&apos;s printed level (often 11 / 12 / 20). These are in addition to class slots above.
                    </p>
                    <div>
                      {paragonPathGrantedPowers.map((p) => renderPowerCardWithSelections(p, `paragon-${p.id}`))}
                    </div>
                  </div>
                )}
                {paragonMcGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Paragon multiclassing{paragonMcClassName ? ` — ${paragonMcClassName}` : ""}
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Powers from the Paragon path tab (instead of a paragon path). Configure at-will swap, encounter, utility, and daily picks there.
                    </p>
                    <div>
                      {paragonMcGrantedPowers.map((p) => renderPowerCardWithSelections(p, `paragon-mc-${p.id}`))}
                    </div>
                  </div>
                )}
                {epicDestinyGrantedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Epic destiny{selectedEpicDestiny ? ` — ${selectedEpicDestiny.name}` : ""}
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Epic powers from compendium data when your level meets the printed level (commonly 26 / 30).
                    </p>
                    <div>
                      {epicDestinyGrantedPowers.map((p) => renderPowerCardWithSelections(p, `epic-${p.id}`))}
                    </div>
                  </div>
                )}
                {featGrantedPowers.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Powers granted by feats</div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {featGrantedPowers.map(({ feat, powers }) => (
                        <li key={feat.id} style={{ marginBottom: "0.45rem" }}>
                          <span style={{ fontWeight: 600 }}>{feat.name}</span>
                          <div style={{ marginTop: "0.2rem" }}>
                            {powers.map((p) => renderPowerCardWithSelections(p, `${feat.id}-${p.id}`))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {featPowerReplaceRows.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Feat power swaps
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Use the swap checkboxes on eligible class power slots in the Powers tab.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {featPowerReplaceRows.map((row) => (
                        <li key={row.feat.id} style={{ marginBottom: "0.2rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.feat.name}</span>
                          {" → "}
                          {row.offer.replacementPowerName}
                          {row.activeSlotKey
                            ? ` (${powerSlotDefs.find((d) => d.key === row.activeSlotKey)?.label ?? row.activeSlotKey})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {multiclassSlotSwapRows.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Multiclass power swaps
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Swap one class power slot for a power from{" "}
                      <span style={{ fontWeight: 600 }}>
                        {classNameById.get(multiclassSlotSwapRows[0]?.multiclassClassId ?? "") ?? "your multiclass"}
                      </span>
                      . Use the controls on eligible slots below.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {multiclassSlotSwapRows.map((row) => {
                        const replName = row.activeReplacementPowerId
                          ? index.powers.find((p) => p.id === row.activeReplacementPowerId)?.name
                          : undefined;
                        return (
                          <li key={row.feat.id} style={{ marginBottom: "0.2rem" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.feat.name}</span>
                            {replName && row.activeSlotKey
                              ? ` → ${replName} (${powerSlotDefs.find((d) => d.key === row.activeSlotKey)?.label ?? row.activeSlotKey})`
                              : " — not configured yet"}
                          </li>
                        );
                      })}
                    </ul>
                    {showPsionicPowerPointSummary(psionicPowerPointSummary) && (
                      <div
                        style={{
                          marginTop: "0.45rem",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "6px",
                          border: "1px solid color-mix(in srgb, var(--status-info) 30%, var(--panel-border))",
                          backgroundColor: "color-mix(in srgb, var(--status-info) 6%, var(--surface-1))"
                        }}
                      >
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                          {psionicPowerPointSummary.baseFromClass > 0 ? "Power points" : "Power point adjustments"}
                        </div>
                        {psionicPowerPointSummary.baseFromClass > 0 && (
                          <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Class pool</span>
                            {": "}
                            {psionicPowerPointSummary.baseFromClass} ({psionicPoolLabel})
                          </p>
                        )}
                        {psionicPowerPointSummary.lines.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            {psionicPowerPointSummary.lines.map((line) => (
                              <li key={line.label} style={{ marginBottom: "0.15rem" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{line.label}</span>
                                {": "}
                                {line.delta > 0 ? "+" : ""}
                                {line.delta}
                                {line.detail ? ` (${line.detail})` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                        {(psionicPowerPointSummary.baseFromClass > 0 || psionicPowerPointSummary.lines.length > 0) && (
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                            Total pool: <strong>{psionicPowerPointSummary.poolTotal}</strong>
                            {psionicPowerPointSummary.totalAdjustments !== 0 && (
                              <>
                                {" "}
                                ({psionicPowerPointSummary.baseFromClass} base
                                {psionicPowerPointSummary.totalAdjustments > 0 ? " + " : " "}
                                {psionicPowerPointSummary.totalAdjustments > 0 ? "+" : ""}
                                {psionicPowerPointSummary.totalAdjustments} adjustments)
                              </>
                            )}
                          </p>
                        )}
                        {psionicPowerPointSummary.paragonPrimaryAtWillSlotPenalty > 0 && (
                          <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                            Paragon multiclassing into a psionic class from a non-psionic class: lose one class at-will
                            slot (in addition to the at-will swap).
                          </p>
                        )}
                        {hybridPsionicAugmentationBreakpoints.length > 0 && (
                          <div style={{ marginTop: "0.4rem" }}>
                            <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                              At each level below, choose power points or one encounter use of an augmentable at-will
                              (PHB3 hybrid psionic augmentation).
                            </p>
                            {hybridPsionicAugmentationBreakpoints.map((bp) => {
                              const choice =
                                build.hybridPsionicAugmentationChoices?.[bp] ?? "powerPoints";
                              const setChoice = (nextChoice: HybridPsionicAugmentationChoice) => {
                                updateBuild({
                                  ...build,
                                  hybridPsionicAugmentationChoices: {
                                    ...build.hybridPsionicAugmentationChoices,
                                    [bp]: nextChoice
                                  }
                                });
                              };
                              return (
                                <div
                                  key={bp}
                                  style={{
                                    marginBottom: "0.35rem",
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)"
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                    Level {bp}
                                  </span>
                                  {": "}
                                  <label style={{ marginRight: "0.65rem", cursor: "pointer" }}>
                                    <input
                                      type="radio"
                                      name={`hybrid-psionic-aug-${bp}`}
                                      checked={choice === "powerPoints"}
                                      onChange={() => setChoice("powerPoints")}
                                      style={{ marginRight: "0.25rem" }}
                                    />
                                    Power points
                                  </label>
                                  <label style={{ cursor: "pointer" }}>
                                    <input
                                      type="radio"
                                      name={`hybrid-psionic-aug-${bp}`}
                                      checked={choice === "encounter"}
                                      onChange={() => setChoice("encounter")}
                                      style={{ marginRight: "0.25rem" }}
                                    />
                                    Encounter use
                                  </label>
                                </div>
                              );
                            })}
                            {psionicPowerPointSummary.hybridEncounterAugmentationBreakpoints.length > 0 && (
                              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                Encounter use at levels{" "}
                                {psionicPowerPointSummary.hybridEncounterAugmentationBreakpoints.join(", ")}: augmentable
                                at-will usable once per encounter.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {featClassFeatureModifications.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Feat augmentations on class features
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {featClassFeatureModifications.map((row) => (
                        <li key={row.classFeatureId} style={{ marginBottom: "0.35rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.classFeatureName}</span>
                          <ul style={{ margin: "0.15rem 0 0 0", paddingLeft: "1rem" }}>
                            {row.augmentations.map((aug) => (
                              <li key={aug.featId} style={{ marginBottom: "0.12rem" }}>
                                <span style={{ fontWeight: 600 }}>{aug.featName}</span>
                                {": "}
                                {aug.text}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {featModifiedPowers.length > 0 && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Feat augmentations on your powers
                    </div>
                    <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Augmentation rules appear on the matching power cards above and in your class power slots.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {featModifiedPowers.map(({ feat, powers }) => (
                        <li key={feat.id} style={{ marginBottom: "0.25rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{feat.name}</span>
                          {": "}
                          {powers.map((p) => p.name).join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {proficiencyDisplayRows.length > 0 && (
                  <div style={{ marginTop: "0.65rem" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      Proficiencies from feats & race
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {proficiencyDisplayRows.map((row) => (
                        <li key={row.sourceId} style={{ marginBottom: "0.35rem" }}>
                          <span style={{ fontWeight: 600 }}>{row.sourceName}</span>
                          <ul style={{ margin: "0.15rem 0 0 0", paddingLeft: "1rem", color: "var(--text-secondary)" }}>
                            {row.grants.map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
            {isHybridBuild ? (
              !hybridClassSelectionComplete ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Choose two hybrid classes on the Class tab to assign powers.
                </p>
              ) : null
            ) : !selectedClass ? (
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>Choose a class on the Class tab to assign powers.</p>
            ) : null}
            {(isHybridBuild ? hybridClassSelectionComplete : !!selectedClass) && (
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
                      border: "1px solid var(--panel-border)",
                      borderRadius: "6px",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
                {dilettantePowerGroups.length > 0 && (
                  <>
                    <h4
                      style={{
                        ...subsectionTitleStyle,
                        marginBottom: "0.5rem",
                        borderBottom: "1px solid var(--panel-border)",
                        paddingBottom: "0.25rem"
                      }}
                    >
                      Dilettante
                    </h4>
                    {dilettantePowerGroups.map((g) => {
                      const selectedPowId = build.raceSelections?.[racePowerSelectSelectionKey(g.traitId)] || "";
                      let candidates = filterPowersByQuery(dilettanteCandidatePowers, powerSearch);
                      if (selectedPowId && !candidates.some((p) => p.id === selectedPowId)) {
                        const orphan = index.powers.find((p) => p.id === selectedPowId);
                        if (orphan) candidates = [orphan, ...candidates];
                      }
                      const selPow = selectedPowId
                        ? resolveDilettanteDisplayPower(index, build, selectedPowId)
                        : undefined;
                      return (
                        <section key={`dilettante-${g.traitId}`} style={{ marginBottom: "1rem" }}>
                          <div style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)", padding: "0.65rem 0.75rem" }}>
                            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-primary)" }}>
                              {g.traitName} (Dilettante)
                            </label>
                            <p style={{ margin: "0 0 0.45rem 0", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                              Choose a 1st-level at-will attack power from another class. You use it as an encounter power
                              (once per encounter).
                            </p>
                            {!classIdForDilettante ? (
                              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--status-warning)" }}>
                                Choose a standard class or hybrid classes on the Class tab to load other classes&apos; at-will powers.
                              </p>
                            ) : candidates.length === 0 ? (
                              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.86rem" }}>
                                {powerSearch.trim()
                                  ? "No powers match this filter; clear search to see the full Dilettante list."
                                  : "No eligible at-will attack powers from other classes in the loaded rules data."}
                              </p>
                            ) : (
                              <select
                                value={selectedPowId}
                                disabled={!classIdForDilettante}
                                onChange={(e) => commitRacePowerSelection(g.traitId, e.target.value)}
                                style={{
                                  width: "100%",
                                  maxWidth: "28rem",
                                  padding: "0.4rem",
                                  borderRadius: "6px",
                                  border: "1px solid var(--panel-border)",
                                  boxSizing: "border-box"
                                }}
                              >
                                <option value="">— Choose power —</option>
                                {candidates.map((power) => {
                                  const clsName = index.classes.find((c) => c.id === power.classId)?.name || "";
                                  return (
                                    <option key={power.id} value={power.id}>
                                      {clsName ? `${clsName}: ` : ""}
                                      {power.name}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                            {selPow ? (
                              <div style={{ marginTop: "0.45rem" }}>
                                {renderPowerCardWithSelections(selPow, `dilettante-${g.traitId}-${selPow.id}`, selPow)}
                              </div>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </>
                )}
                {powerSlotDefs.map((def, idx) => {
                  const showBucketHeader = idx === 0 || powerSlotDefs[idx - 1].bucket !== def.bucket;
                  const slotsMap = build.classPowerSlots || {};
                  const taken = new Set(
                    Object.entries(slotsMap)
                      .filter(([k, v]) => k !== def.key && v)
                      .map(([, v]) => resolveBaseAugmentablePowerId(index, v))
                  );
                  const pool: Power[] =
                    def.bucket === "utility"
                      ? classUtilityPowers
                      : classAttackPowers.filter((p) => attackPowerBucketFromUsage(p.usage) === def.bucket);
                  let poolForSlot = pool.filter((p) => powerPrintedLevelEligibleForSlot(p, def));
                  if (
                    isHybridBuild &&
                    hybridBaseClassAId &&
                    hybridBaseClassBId &&
                    def.key.startsWith("hybrid:")
                  ) {
                    poolForSlot = poolForSlot.filter((p) =>
                      powerAllowedForHybridSlot(def.key, p, hybridBaseClassAId, hybridBaseClassBId)
                    );
                  }
                  const value = slotsMap[def.key]
                    ? resolveBaseAugmentablePowerId(index, slotsMap[def.key])
                    : "";
                  const selPow = value ? index.powers.find((p) => p.id === value) : undefined;
                  let candidates = poolForSlot.filter((p) => !taken.has(p.id) || p.id === value);
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
                        <h4 style={{ ...subsectionTitleStyle, marginBottom: "0.5rem", borderBottom: "1px solid var(--panel-border)", paddingBottom: "0.25rem" }}>
                          {slotBucketSectionTitle(def.bucket)}
                        </h4>
                      )}
                      <div style={{ ...ui.blockSubsection, backgroundColor: "var(--surface-1)", padding: "0.65rem 0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-primary)" }}>
                          {def.label}
                        </label>
                        {isSlotUsedByParagonAtWillSwap(build, def.key) && (
                          <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.76rem", color: "var(--status-info)" }}>
                            Paragon multiclass at-will swap
                            {paragonMcClassName ? ` from ${paragonMcClassName}` : ""}.
                          </p>
                        )}
                        {poolForSlot.length === 0 ? (
                          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.86rem" }}>
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
                              border: "1px solid var(--panel-border)",
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
                          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.78rem", color: "var(--status-warning)" }}>
                            No powers match this filter; clear search to see options for this slot.
                          </p>
                        )}
                        {(featReplaceRowsBySlotKey.get(def.key) || []).map((row) => {
                          const active = row.activeSlotKey === def.key;
                          const replPow = index.powers.find((p) => p.id === row.offer.replacementPowerId);
                          return (
                            <div
                              key={`${row.feat.id}-${def.key}`}
                              style={{
                                marginTop: "0.45rem",
                                padding: "0.4rem 0.5rem",
                                borderRadius: "6px",
                                border: "1px solid color-mix(in srgb, var(--status-info) 35%, var(--panel-border))",
                                backgroundColor: "color-mix(in srgb, var(--status-info) 8%, var(--surface-1))"
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "0.4rem",
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  cursor: "pointer"
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={(e) =>
                                    commitFeatPowerReplaceToggle(
                                      row.feat.id,
                                      def.key,
                                      row.offer.replacementPowerId,
                                      e.target.checked
                                    )
                                  }
                                  style={{ marginTop: "0.15rem" }}
                                />
                                <span>
                                  <strong style={{ color: "var(--text-primary)" }}>Swap</strong> for{" "}
                                  <span style={{ color: "var(--status-info)" }}>{row.offer.replacementPowerName}</span>
                                  {row.offer.optional ? " (optional)" : ""} — from{" "}
                                  <span style={{ fontWeight: 600 }}>{row.feat.name}</span>
                                </span>
                              </label>
                              {active && replPow ? (
                                <div style={{ marginTop: "0.35rem" }}>
                                  {renderPowerCardWithSelections(replPow, `swap-${row.feat.id}-${def.key}`)}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {(multiclassSwapRowsBySlotKey.get(def.key) || []).map((row) => {
                          const active = row.activeSlotKey === def.key;
                          const mcPowers = multiclassPowersForSlotSwap(index, row.multiclassClassId, def, row.offer);
                          const selectedRepl = active ? row.activeReplacementPowerId || "" : "";
                          const replPow = selectedRepl ? index.powers.find((p) => p.id === selectedRepl) : undefined;
                          const mcClassName = classNameById.get(row.multiclassClassId) ?? "multiclass";
                          return (
                            <div
                              key={`mc-${row.feat.id}-${def.key}`}
                              style={{
                                marginTop: "0.45rem",
                                padding: "0.4rem 0.5rem",
                                borderRadius: "6px",
                                border: "1px solid color-mix(in srgb, var(--status-info) 35%, var(--panel-border))",
                                backgroundColor: "color-mix(in srgb, var(--status-info) 8%, var(--surface-1))"
                              }}
                            >
                              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
                                {row.feat.name} — swap for {mcClassName} power
                              </div>
                              {mcPowers.length === 0 ? (
                                <p style={{ margin: 0, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                  No {def.bucket} powers from {mcClassName} at printed level {def.gainLevel} or below.
                                </p>
                              ) : (
                                <>
                                  <label style={{ display: "block", fontSize: "0.76rem", marginBottom: "0.25rem", color: "var(--text-secondary)" }}>
                                    Multiclass power
                                    <select
                                      value={selectedRepl}
                                      onChange={(e) => {
                                        const pid = e.target.value;
                                        if (!pid) {
                                          if (active) commitMulticlassSlotSwapToggle(row.feat.id, def.key, "", false);
                                          return;
                                        }
                                        if (active) commitMulticlassSlotSwapPowerChange(row.feat.id, pid);
                                        else commitMulticlassSlotSwapToggle(row.feat.id, def.key, pid, true);
                                      }}
                                      style={{
                                        display: "block",
                                        width: "100%",
                                        maxWidth: "28rem",
                                        marginTop: "0.15rem",
                                        padding: "0.35rem",
                                        borderRadius: "6px",
                                        border: "1px solid var(--panel-border)"
                                      }}
                                    >
                                      <option value="">— Choose multiclass power —</option>
                                      {mcPowers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name} (Lv {p.level ?? "?"}, {p.usage || "?"})
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                    Choose a power to swap this slot{row.offer.optional ? " (optional)" : ""}.
                                    {row.offer.replacementUsedAsEncounter
                                      ? " Swapped power is usable once per encounter."
                                      : ""}
                                    {row.offer.powerPointSwapChange && active
                                      ? (() => {
                                          const state = build.featPowerReplacements?.[row.feat.id];
                                          const level =
                                            row.offer.powerPointSwapChange === "gain"
                                              ? (index.powers.find((p) => p.id === state?.replacementPowerId)?.level ?? 1)
                                              : (index.powers.find((p) => p.id === state?.originalPowerId)?.level ?? 1);
                                          const pts = powerPointsForPrintedLevel(level);
                                          return row.offer.powerPointSwapChange === "gain"
                                            ? ` Gain ${pts} power points.`
                                            : ` Lose ${pts} power points.`;
                                        })()
                                      : ""}
                                  </p>
                                </>
                              )}
                              {active && replPow ? (
                                <div style={{ marginTop: "0.35rem" }}>
                                  {renderPowerCardWithSelections(replPow, `mc-swap-${row.feat.id}-${def.key}`)}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {selPow && !featReplaceRowsBySlotKey.get(def.key)?.some((r) => r.activeSlotKey === def.key) && !multiclassSwapRowsBySlotKey.get(def.key)?.some((r) => r.activeSlotKey === def.key) ? (
                          <div style={{ marginTop: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Selected power card</div>
                            {renderPowerCardWithSelections(selPow, `slot-${def.key}-${selPow.id}`)}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>
        )}

        {activeTab === "theme" && (
          <div>
            <h3 style={builderSectionTitleStyle}>Theme</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
              Themes are optional packages with prerequisites.
            </p>

            <section style={{ marginBottom: "1.25rem" }}>
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
                    border: "1px solid var(--panel-border)",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, themeId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--panel-border)", background: "var(--surface-0)", cursor: "pointer" }}
                >
                  Clear theme
                </button>
                {build.themeId && selectedTheme && (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Selected: <strong>{selectedTheme.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockSubsection, maxHeight: "220px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredThemes.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No themes match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredThemes.map((t) => {
                      const selected = build.themeId === t.id;
                      const { legal, reasons } = themeLegalityById.get(t.id) ?? { legal: false, reasons: [] };
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
                              border: selected ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
                              background: !legal ? "var(--surface-2)" : selected ? "var(--surface-2)" : "var(--surface-0)",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {t.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--status-warning)" }}>Invalid</span>
                              )}
                            </span>
                            {t.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>{t.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "var(--status-warning)", marginTop: "0.15rem", fontWeight: 400 }}>
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
                <p style={{ ...ui.blockSubsection, marginTop: "0.65rem", fontStyle: "italic", fontSize: "0.9rem" }}>{selectedTheme.raw.flavor}</p>
              )}
              {selectedTheme?.raw?.body && typeof selectedTheme.raw.body === "string" && (
                <CollapsibleDisclosure
          open
          style={{ marginTop: "0.5rem" }}
          summary="Theme details"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText text={String(selectedTheme.raw.body)} paragraphStyle={{ fontSize: "0.9rem" }} listItemStyle={{ fontSize: "0.9rem" }} />
        </CollapsibleDisclosure>
              )}
              {themeGrantedPowers.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <h5 style={subsectionTitleStyle}>Powers from this theme</h5>
                  <p style={{ margin: "0 0 0.45rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    These are granted when your level reaches each power&apos;s printed level (same list as on the Powers tab).
                  </p>
                  <div>{themeGrantedPowers.map((p) => renderPowerCardWithSelections(p, `theme-tab-${p.id}`))}</div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "paragonPath" && build.level >= 11 && (
          <div>
            <h3 style={builderSectionTitleStyle}>Paragon path</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
              Paragon paths require <strong>level 11+</strong>. Dropping level clears a path that is no longer legal.
            </p>

            <section style={{ marginBottom: "1.25rem" }}>
              {build.level < 11 && (
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--status-warning)" }}>Set level to 11 or higher to choose a paragon path.</p>
              )}
              {paragonMcEligible && (
                <div
                  style={{
                    marginBottom: "0.85rem",
                    padding: "0.55rem 0.65rem",
                    border: "1px solid var(--panel-border)",
                    borderRadius: "8px",
                    background: "var(--surface-1)"
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.88rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(build.paragonMulticlassing)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateBuild({
                            ...build,
                            paragonMulticlassing: true,
                            paragonPathId: undefined
                          });
                          return;
                        }
                        updateBuild(
                          disableParagonAtWillSwap({
                            ...build,
                            paragonMulticlassing: undefined,
                            paragonPathId: build.paragonPathId,
                            paragonMulticlassPowers: undefined
                          })
                        );
                      }}
                    />
                    <span>
                      <strong>Paragon multiclassing</strong>
                      {paragonMcClassName ? ` (${paragonMcClassName})` : ""}
                    </span>
                  </label>
                  <p style={{ margin: "0.35rem 0 0 1.55rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Requires Novice, Acolyte, and Adept Power. Replaces paragon path benefits with powers from your multiclass class.
                    {psionicPowerPointSummary.lines.some((l) => l.label === "Paragon multiclassing") ? (
                      <>
                        {" "}
                        At 11th level you gain +2 power points when multiclassing into a psionic class.
                        {psionicPowerPointSummary.paragonPrimaryAtWillSlotPenalty > 0
                          ? " You also have one fewer class at-will attack slot from your primary class."
                          : ""}
                      </>
                    ) : null}
                  </p>
                  {build.paragonMulticlassing && paragonMcClassId && (
                    <div style={{ marginTop: "0.5rem", marginLeft: "1.55rem", display: "grid", gap: "0.4rem" }}>
                      {build.level >= 11 && (
                        <>
                          <label style={{ fontSize: "0.82rem" }}>
                            At-will slot to swap
                            <select
                              value={build.paragonMulticlassPowers?.atWillSwapSlotKey ?? ""}
                              onChange={(e) => {
                                const slotKey = e.target.value;
                                const powerId = build.paragonMulticlassPowers?.atWillSwapPowerId ?? "";
                                if (!slotKey || !powerId) {
                                  commitParagonAtWillSwap(slotKey, "");
                                  return;
                                }
                                commitParagonAtWillSwap(slotKey, powerId);
                              }}
                              style={{ display: "block", width: "100%", maxWidth: "24rem", marginTop: "0.15rem" }}
                            >
                              <option value="">— Choose at-will slot —</option>
                              {paragonAtWillSlots.map((d) => (
                                <option key={d.key} value={d.key}>
                                  {d.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ fontSize: "0.82rem" }}>
                            Multiclass at-will power (optional)
                            <select
                              value={build.paragonMulticlassPowers?.atWillSwapPowerId ?? ""}
                              onChange={(e) => {
                                const powerId = e.target.value;
                                const slotKey = build.paragonMulticlassPowers?.atWillSwapSlotKey ?? "";
                                if (!powerId) {
                                  commitParagonAtWillSwap("", "");
                                  return;
                                }
                                if (!slotKey) {
                                  updateBuild({
                                    ...build,
                                    paragonMulticlassPowers: {
                                      ...build.paragonMulticlassPowers,
                                      atWillSwapPowerId: powerId
                                    }
                                  });
                                  return;
                                }
                                commitParagonAtWillSwap(slotKey, powerId);
                              }}
                              style={{ display: "block", width: "100%", maxWidth: "24rem", marginTop: "0.15rem" }}
                            >
                              <option value="">—</option>
                              {paragonMcPowerOptions.atWill.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Lv {p.level})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ fontSize: "0.82rem" }}>
                            Paragon encounter (7th or lower)
                            <select
                              value={build.paragonMulticlassPowers?.encounterPowerId ?? ""}
                              onChange={(e) =>
                                updateBuild({
                                  ...build,
                                  paragonMulticlassPowers: {
                                    ...build.paragonMulticlassPowers,
                                    encounterPowerId: e.target.value || undefined
                                  }
                                })
                              }
                              style={{ display: "block", width: "100%", maxWidth: "24rem", marginTop: "0.15rem" }}
                            >
                              <option value="">—</option>
                              {paragonMcPowerOptions.encounter.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Lv {p.level})
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      {build.level >= 12 && (
                        <label style={{ fontSize: "0.82rem" }}>
                          Paragon utility (10th or lower)
                          <select
                            value={build.paragonMulticlassPowers?.utilityPowerId ?? ""}
                            onChange={(e) =>
                              updateBuild({
                                ...build,
                                paragonMulticlassPowers: {
                                  ...build.paragonMulticlassPowers,
                                  utilityPowerId: e.target.value || undefined
                                }
                              })
                            }
                            style={{ display: "block", width: "100%", maxWidth: "24rem", marginTop: "0.15rem" }}
                          >
                            <option value="">—</option>
                            {paragonMcPowerOptions.utility.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Lv {p.level})
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {build.level >= 20 && (
                        <label style={{ fontSize: "0.82rem" }}>
                          Paragon daily (19th or lower)
                          <select
                            value={build.paragonMulticlassPowers?.dailyPowerId ?? ""}
                            onChange={(e) =>
                              updateBuild({
                                ...build,
                                paragonMulticlassPowers: {
                                  ...build.paragonMulticlassPowers,
                                  dailyPowerId: e.target.value || undefined
                                }
                              })
                            }
                            style={{ display: "block", width: "100%", maxWidth: "24rem", marginTop: "0.15rem" }}
                          >
                            <option value="">—</option>
                            {paragonMcPowerOptions.daily.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Lv {p.level})
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  )}
                </div>
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
                    border: "1px solid var(--panel-border)",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, paragonPathId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--panel-border)", background: "var(--surface-0)", cursor: "pointer" }}
                >
                  Clear paragon path
                </button>
                {build.paragonPathId && selectedParagonPath && (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Selected: <strong>{selectedParagonPath.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockSubsection, maxHeight: "240px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredParagonPaths.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No paragon paths match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredParagonPaths.map((p) => {
                      const selected = build.paragonPathId === p.id;
                      const { legal, reasons } = paragonLegalityById.get(p.id) ?? { legal: false, reasons: [] };
                      return (
                        <li key={p.id} style={{ marginBottom: "0.2rem" }}>
                          <button
                            type="button"
                            disabled={!legal || Boolean(build.paragonMulticlassing)}
                            onClick={() => {
                              if (legal && !build.paragonMulticlassing) {
                                updateBuild({ ...build, paragonPathId: p.id, paragonMulticlassing: false });
                              }
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.45rem 0.55rem",
                              borderRadius: "6px",
                              border: selected ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
                              background: !legal ? "var(--surface-2)" : selected ? "var(--surface-2)" : "var(--surface-0)",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {p.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--status-warning)" }}>Invalid</span>
                              )}
                            </span>
                            {p.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>{p.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "var(--status-warning)", marginTop: "0.15rem", fontWeight: 400 }}>
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
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <strong>Prerequisites:</strong> {selectedParagonPath.prereqsRaw}
                </p>
              )}
              {selectedParagonPath?.raw?.body && typeof selectedParagonPath.raw.body === "string" && (
                <CollapsibleDisclosure
          open
          style={{ marginTop: "0.5rem" }}
          summary="Paragon path details"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText
                      text={String(selectedParagonPath.raw.body)}
                      paragraphStyle={{ fontSize: "0.9rem" }}
                      listItemStyle={{ fontSize: "0.9rem" }}
                    />
        </CollapsibleDisclosure>
              )}
            </section>
          </div>
        )}

        {activeTab === "epicDestiny" && build.level >= 21 && (
          <div>
            <h3 style={builderSectionTitleStyle}>Epic destiny</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
              Epic destinies require <strong>level 21+</strong>. Dropping level clears a destiny that is no longer legal.
            </p>

            <section>
              {build.level < 21 && (
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--status-warning)" }}>Set level to 21 or higher to choose an epic destiny.</p>
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
                    border: "1px solid var(--panel-border)",
                    borderRadius: "6px",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.45rem" }}>
                <button
                  type="button"
                  onClick={() => updateBuild({ ...build, epicDestinyId: undefined })}
                  style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--panel-border)", background: "var(--surface-0)", cursor: "pointer" }}
                >
                  Clear epic destiny
                </button>
                {build.epicDestinyId && selectedEpicDestiny && (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Selected: <strong>{selectedEpicDestiny.name}</strong>
                  </span>
                )}
              </div>
              <div style={{ ...ui.blockSubsection, maxHeight: "240px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredEpicDestinies.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No epic destinies match this search.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {filteredEpicDestinies.map((d) => {
                      const selected = build.epicDestinyId === d.id;
                      const { legal, reasons } = epicLegalityById.get(d.id) ?? { legal: false, reasons: [] };
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
                              border: selected ? "1px solid var(--panel-border-strong)" : "1px solid transparent",
                              background: !legal ? "var(--surface-2)" : selected ? "var(--surface-2)" : "var(--surface-0)",
                              cursor: !legal ? "not-allowed" : "pointer",
                              fontSize: "0.88rem",
                              opacity: !legal ? 0.92 : 1
                            }}
                          >
                            <span style={{ fontWeight: selected ? 600 : 500 }}>
                              {d.name}
                              {!legal && (
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--status-warning)" }}>Invalid</span>
                              )}
                            </span>
                            {d.source && (
                              <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>{d.source}</span>
                            )}
                            {!legal && reasons.length > 0 && (
                              <span style={{ display: "block", fontSize: "0.72rem", color: "var(--status-warning)", marginTop: "0.15rem", fontWeight: 400 }}>
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
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <strong>Prerequisites:</strong> {selectedEpicDestiny.prereqsRaw}
                </p>
              )}
              {selectedEpicDestiny?.raw?.body && typeof selectedEpicDestiny.raw.body === "string" && (
                <CollapsibleDisclosure
          open
          style={{ marginTop: "0.5rem" }}
          summary="Epic destiny details"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.4rem" }}
        >
          <RulesRichText
                      text={String(selectedEpicDestiny.raw.body)}
                      paragraphStyle={{ fontSize: "0.9rem" }}
                      listItemStyle={{ fontSize: "0.9rem" }}
                    />
        </CollapsibleDisclosure>
              )}
            </section>
          </div>
        )}

        {activeTab === "equipment" && (
          <div style={{ display: "grid", gap: "0.55rem" }}>
            <EquipmentTab
              index={index}
              build={build}
              onBuildChange={updateBuild}
              magicCombat={magicCombat}
              gold={build.gold ?? 0}
              onGoldChange={(nextGold) => updateBuild({ ...build, gold: Math.max(0, Math.trunc(nextGold)) })}
              onAddToInventory={(slot: EquipmentEditorSlot) => {
                updateBuild(addAcquiredEquipmentToBuild(build, index, slot));
              }}
              onBuy={(slot: EquipmentEditorSlot) => {
                const equipment = normalizeCharacterEquipment(build.equipment);
                const cost = equipmentSlotGoldCost(index, slot, equipment);
                if (cost == null) return;
                const currentGold = build.gold ?? 0;
                if (currentGold < cost) return;
                updateBuild({
                  ...addAcquiredEquipmentToBuild(build, index, slot),
                  gold: currentGold - cost
                });
              }}
            />
            <div style={ui.equipmentSubPanel}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Equipped</div>
              <CharacterEquippedSlotsPanel
                inventory={build.inventory ?? []}
                equippedSlots={build.equippedSlots ?? {}}
                characterEquipment={build.equipment}
                index={index}
                onEquipItem={(itemId, slot) => updateBuild(equipInventoryItemOnBuild(build, itemId, slot, index))}
                onUnequipItem={(itemId, slot) => updateBuild(unequipInventoryItemOnBuild(build, itemId, slot, index))}
              />
            </div>
            <div style={ui.equipmentSubPanel}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
                {builderInventoryItems.length > 0
                  ? `Items (${builderInventoryItems.length})`
                  : "Items"}
              </div>
              <CharacterInventoryList
                items={builderInventoryItems}
                emptyMessage="No items yet. Use Add to inventory or Buy on a slot above."
                onEquipItem={(itemId, slot) => updateBuild(equipInventoryItemOnBuild(build, itemId, slot, index))}
                onUnequipItem={(itemId, slot) => updateBuild(unequipInventoryItemOnBuild(build, itemId, slot, index))}
                onRemoveItem={(itemId) => {
                  const nextEquipped = { ...(build.equippedSlots ?? {}) };
                  for (const [slot, id] of Object.entries(nextEquipped)) {
                    if (id === itemId) delete nextEquipped[slot as EquippedSlotKey];
                  }
                  updateBuild({
                    ...build,
                    inventory: (build.inventory ?? []).filter((item) => item.id !== itemId),
                    equippedSlots: nextEquipped
                  });
                }}
              />
            </div>
          </div>
        )}

        <JsonCollapsiblePanel
          title="JSON"
          jsonText={expandedBuildJson}
          shellStyle={{ ...ui.blockInset, marginTop: "0.75rem", backgroundColor: "var(--surface-0)" }}
        />
      </div>

      <div
        style={{
          ...ui.sidebarStack,
          flex: useSingleColumnLayout ? undefined : "0 1 400px",
          maxWidth: useSingleColumnLayout ? "100%" : "min(400px, 100%)",
          width: useSingleColumnLayout ? "100%" : "min(400px, 100%)"
        }}
      >
        <div style={{ ...ui.sidebarPanel, ...ui.validationColumn }}>
          <LiveSheetCollapsibleSection
            title={
              validationIssueCount > 0
                ? `Validation Notes (${validationIssueCount})`
                : "Validation Notes"
            }
            defaultOpen={validationIssueCount > 0}
            summaryStyle={{ textAlign: "left" }}
            bodyStyle={{ textAlign: "left" }}
          >
            {validationIssueCount === 0 ? (
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", textAlign: "left" }}>No validation issues.</p>
            ) : (
              <>
                {legality.warnings.length > 0 && (
                  <ul style={{ margin: "0 0 0.5rem 0", paddingLeft: "1.2rem", color: "var(--status-warning)", fontSize: "0.88rem", textAlign: "left" }}>
                    {legality.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                <ul style={{ margin: 0, paddingLeft: "1.2rem", textAlign: "left", overflowWrap: "anywhere" }}>
                  {featOptions
                    .filter((f) => !f.legal && build.featIds.includes(f.item.id))
                    .flatMap((f) => f.reasons.map((r) => `${f.item.name}: ${r}`))
                    .map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => {
                            const tab = navigateToTabForError(r);
                            if (tab) setActiveTab(tab);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            textDecoration: "underline",
                            cursor: "pointer",
                            padding: 0,
                            color: "var(--text-secondary)",
                            textAlign: "left",
                            display: "block",
                            width: "100%"
                          }}
                        >
                          {r}
                        </button>
                      </li>
                    ))}
                  {legality.errors.map((e) => (
                    <li key={e}>
                      <button
                        type="button"
                        onClick={() => {
                          const tab = navigateToTabForError(e);
                          if (tab) setActiveTab(tab);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: 0,
                          color: "var(--text-secondary)",
                          textAlign: "left",
                          display: "block",
                          width: "100%"
                        }}
                      >
                        {e}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </LiveSheetCollapsibleSection>
        </div>

        {builderSidebarCollapsed ? (
          <div
            style={{
              ...ui.sidebarPanel,
              ...ui.sidebarColumn,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }}
          >
            <button
              type="button"
              className="builder-sidebar-collapse-toggle"
              aria-expanded={false}
              aria-label="Expand character sheet sidebar"
              onClick={() => setBuilderSidebarCollapsed(false)}
            >
              <CollapsibleDisclosureArrow />
              <span style={liveSheetSummaryStyle}>Character</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              ...ui.sidebarPanel,
              ...ui.sidebarColumn,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }}
          >
          <button
            type="button"
            className="builder-sidebar-collapse-toggle"
            aria-expanded
            aria-label="Collapse character sheet sidebar"
            onClick={() => setBuilderSidebarCollapsed(true)}
          >
            <CollapsibleDisclosureArrow />
            <span style={liveSheetSummaryStyle}>Character</span>
          </button>
          <div style={liveSheetSectionBodyStyle}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                <strong {...glossaryTooltipUi.hoverA11y("race")}>Race:</strong> {selectedRace?.name || "None"}
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                <strong {...glossaryTooltipUi.hoverA11y("class")}>Class:</strong>{" "}
                {isHybridBuild && (selectedHybridA || selectedHybridB)
                  ? [selectedHybridA?.name, selectedHybridB?.name].filter(Boolean).join(" + ") || "Hybrid (incomplete)"
                  : selectedClass?.name || "None"}
              </p>
              {isHybridBuild && hybridClassSelectionComplete && (
                <>
                  <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    Base classes: {hybridBaseClassDefA?.name ?? "?"} · {hybridBaseClassDefB?.name ?? "?"}
                  </p>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                    Hybrid talents:{" "}
                    {[
                      selectedHybridA?.hybridTalentClassFeatures?.find((o) => o.id === build.hybridTalentClassFeatureIdA)?.name,
                      selectedHybridB?.hybridTalentClassFeatures?.find((o) => o.id === build.hybridTalentClassFeatureIdB)?.name
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {(selectedHybridA?.hybridSelectionGroups?.length || selectedHybridB?.hybridSelectionGroups?.length) ? (
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      Hybrid options:{" "}
                      {[
                        ...(selectedHybridA?.hybridSelectionGroups ?? []).map((g) => {
                          const id = build.hybridSideASelections?.[g.key];
                          const opt = g.options.find((o) => o.id === id);
                          return opt ? `${g.label}: ${opt.name}` : null;
                        }),
                        ...(selectedHybridB?.hybridSelectionGroups ?? []).map((g) => {
                          const id = build.hybridSideBSelections?.[g.key];
                          const opt = g.options.find((o) => o.id === id);
                          return opt ? `${g.label}: ${opt.name}` : null;
                        })
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  ) : null}
                </>
              )}
              {!isHybridBuild &&
                visibleClassFeatureChoiceGroups.length > 0 &&
                (() => {
                  const rs = build.classSelections || {};
                  const lines = visibleClassFeatureChoiceGroups
                    .map((g) => {
                      if (g.kind === "classFeature") {
                        const opt = g.options.find((o) => o.id === rs[g.key]);
                        return opt ? `${g.parentFeatureName}: ${opt.name}` : null;
                      }
                      const picks = parseClassPowerChoiceSelection(rs[g.key])
                        .map((pid) => index.powers.find((p) => p.id === pid)?.name)
                        .filter(Boolean);
                      return picks.length ? `${g.parentFeatureName}: ${picks.join(", ")}` : null;
                    })
                    .filter(Boolean);
                  if (lines.length === 0) return null;
                  return (
                    <p style={{ margin: 0, fontSize: "0.88rem" }}>
                      <strong>Class choices:</strong> {lines.join(" · ")}
                    </p>
                  );
                })()}
              <p style={{ margin: 0, fontSize: "0.88rem" }}>
                <strong {...glossaryTooltipUi.hoverA11y("level")}>Level:</strong> {build.level}
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Theme:</strong> {selectedTheme?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Paragon Path:</strong> {selectedParagonPath?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Epic Destiny:</strong> {selectedEpicDestiny?.name || "None"}</p>
              {multiclassFeatIdList.length > 0 && (
                <CollapsibleDisclosure
                  style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}
                  summary={`Multiclass-related feats (${multiclassFeatIdList.length})`}
                  summaryStyle={disclosureSummaryStyle}
                  bodyStyle={{ marginTop: "0.35rem" }}
                >
                  <ul style={{ margin: "0.35rem 0 0 0", paddingLeft: "1.1rem" }}>
                    {multiclassFeatIdList.map((fid) => {
                      const f = index.feats.find((x) => x.id === fid);
                      return <li key={fid}>{f?.name ?? fid}</li>;
                    })}
                  </ul>
                  {multiclassEntryFeatIdList.length > 0 && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Training feats:</strong>{" "}
                      {multiclassEntryFeatIdList
                        .map((fid) => index.feats.find((x) => x.id === fid)?.name ?? fid)
                        .join(", ")}
                    </p>
                  )}
                  {countsAsClassLabels.length > 0 && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Counts as class:</strong> {countsAsClassLabels.join(", ")}
                    </p>
                  )}
                  {countsAsFeatureLabels.length > 0 && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Counts as feature:</strong> {countsAsFeatureLabels.join(", ")}
                    </p>
                  )}
                  {internalGrantKeyList.length > 0 && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Internal flags:</strong>{" "}
                      {internalGrantKeyList.map(formatInternalGrantKey).join(", ")}
                    </p>
                  )}
                  {hasKiFocus && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Ki focus:</strong> may use ki focuses as implements
                    </p>
                  )}
                  {hasPsionicSecond && (
                    <p style={{ margin: "0.35rem 0 0 0" }}>
                      <strong>Psionic second class:</strong> second psionic class talent active
                    </p>
                  )}
                </CollapsibleDisclosure>
              )}
          </div>

          <LiveSheetCollapsibleSection title="Combat Stats">
            <div style={{ display: "grid", gap: "0.35rem", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>
                  <strong {...glossaryTooltipUi.hoverA11y("hp")}>HP:</strong> {derived.maxHp}
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>
                  <strong {...glossaryTooltipUi.hoverA11y("surges")}>Healing Surges:</strong> {derived.healingSurgesPerDay}
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>
                  <strong {...glossaryTooltipUi.hoverA11y("surgeValue")}>Surge Value:</strong> {derived.surgeValue}
                </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: "0.35rem 0.75rem",
                  alignItems: "start"
                }}
              >
                <ScoreBreakdownTable
                  variant="stat"
                  fontSize="0.82rem"
                  columns={DEFENSE_SCORE_COLUMNS}
                  bonusHeader={null}
                  labelHeader={null}
                  prioritizeLabel
                  showComponents={false}
                  rows={[
                    {
                      rowKey: "ac",
                      label: "AC",
                      glossaryKey: "ac",
                      total: derived.defenses.ac,
                      values: {}
                    },
                    {
                      rowKey: "fortitude",
                      label: "Fortitude",
                      glossaryKey: "fortitude",
                      total: derived.defenses.fortitude,
                      values: {}
                    },
                    {
                      rowKey: "reflex",
                      label: "Reflex",
                      glossaryKey: "reflex",
                      total: derived.defenses.reflex,
                      values: {}
                    },
                    {
                      rowKey: "will",
                      label: "Will",
                      glossaryKey: "will",
                      total: derived.defenses.will,
                      values: {}
                    }
                  ]}
                  renderLabel={(row) => (
                    <strong {...glossaryTooltipUi.hoverA11y(row.glossaryKey ?? row.rowKey)} style={{ fontSize: "0.82rem" }}>
                      {row.label}
                    </strong>
                  )}
                />
                <ScoreBreakdownTable
                  variant="stat"
                  fontSize="0.82rem"
                  columns={MOTION_INITIATIVE_COLUMNS}
                  bonusHeader={null}
                  labelHeader={null}
                  prioritizeLabel
                  showComponents={false}
                  rows={[
                    {
                      rowKey: "initiative",
                      label: "Initiative",
                      glossaryKey: "initiative",
                      total: derived.initiative,
                      signedTotal: true,
                      values: {}
                    },
                    {
                      rowKey: "speed",
                      label: "Speed",
                      glossaryKey: "speed",
                      total: derived.speed,
                      values: {}
                    }
                  ]}
                  renderLabel={(row) => (
                    <strong {...glossaryTooltipUi.hoverA11y(row.glossaryKey ?? row.rowKey)} style={{ fontSize: "0.82rem" }}>
                      {row.label}
                    </strong>
                  )}
                />
              </div>
            </div>
            <SupportPassiveMotionBreakdown o={derived.supportPassiveOther} summaryStyle={disclosureSummaryStyle} />
            {derived.armorCheckPenalty > 0 && (
              <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.82rem", color: "var(--status-warning)" }}>
                Armor check penalty −{derived.armorCheckPenalty} on untrained Strength / Dexterity skills (see Skills).
              </p>
            )}
            {(mainWeaponSummary || offHandWeaponSummary || implementAttackSummary) && (
              <div style={{ marginTop: "0.45rem", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                <p style={{ margin: "0.15rem 0", color: "var(--text-muted)" }}>
                  Attack bonus uses half-level + relevant ability modifier + proficiency bonus (or nonproficient -2).
                </p>
                {mainWeaponSummary && selectedMainWeapon && (
                  <p style={{ margin: "0.15rem 0" }}>
                    <strong>Weapon (main):</strong> {selectedMainWeapon.name} — attack{" "}
                    {mainWeaponSummary.attackBonus >= 0 ? "+" : ""}
                    {mainWeaponSummary.attackBonus} vs AC ({mainWeaponSummary.abilityCode}); damage {mainWeaponSummary.damageNotation}
                    {!mainWeaponSummary.proficient && (
                      <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient −2 applied in bonus)</span>
                    )}
                  </p>
                )}
                {offHandWeaponSummary && selectedOffHandWeapon && (
                  <p style={{ margin: "0.15rem 0" }}>
                    <strong>Weapon (off):</strong> {selectedOffHandWeapon.name} — attack{" "}
                    {offHandWeaponSummary.attackBonus >= 0 ? "+" : ""}
                    {offHandWeaponSummary.attackBonus} vs AC ({offHandWeaponSummary.abilityCode}); damage {offHandWeaponSummary.damageNotation}
                    {!offHandWeaponSummary.proficient && (
                      <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient −2 applied in bonus)</span>
                    )}
                  </p>
                )}
                {implementAttackSummary && selectedImplement && (
                  <p style={{ margin: "0.15rem 0" }}>
                    <strong>Implement:</strong> {selectedImplement.name} — attack{" "}
                    {implementAttackSummary.attackBonus >= 0 ? "+" : ""}
                    {implementAttackSummary.attackBonus} vs AC (best key ability)
                    {!implementAttackSummary.proficient && (
                      <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient −2 applied in bonus)</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </LiveSheetCollapsibleSection>

          <LiveSheetCollapsibleSection
            title="Ability Scores"
            summaryA11y={glossaryTooltipUi.hoverA11y("abilityScores")}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.3rem 0.75rem", fontVariantNumeric: "tabular-nums" }}>
              {abilities.map((ability) => {
                const score = effectiveAbilityScores[ability];
                const mod = abilityModifier(score);
                return (
                  <p key={ability} style={{ margin: 0, fontSize: "0.88rem" }}>
                    <strong {...glossaryTooltipUi.hoverA11y(`ability:${ability}`)}>{ability}:</strong> {score} ({formatAbilityMod(mod)})
                  </p>
                );
              })}
            </div>
          </LiveSheetCollapsibleSection>

          <LiveSheetCollapsibleSection title="Skills">
            <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Includes untrained skills; trained rows add +5 and ignore armor check penalty.
            </p>
            <ScoreBreakdownTable
              variant="skill"
              columns={SKILL_BREAKDOWN_COLUMNS}
              rows={skillRowsToBreakdown(skillSheetRows)}
              fontSize="0.75rem"
              formatTotalValue={(row) => formatSkillBreakdownTotal(skillRowMap(skillSheetRows).get(row.rowKey)!)}
              formatComponentValue={(row, columnKey) =>
                formatSkillBreakdownComponent(skillRowMap(skillSheetRows).get(row.rowKey)!, columnKey)
              }
              renderLabel={(row, stripe) => (
                <SkillModifierNameContent
                  row={skillRowMap(skillSheetRows).get(row.rowKey)!}
                  {...glossaryTooltipUi.hoverA11y(`skill:${row.rowKey}`)}
                  style={{
                    color: "var(--text-secondary)",
                    padding: "0.12rem 0.2rem",
                    borderRadius: "0.2rem",
                    backgroundColor: stripe,
                    fontWeight: 600
                  }}
                />
              )}
            />
          </LiveSheetCollapsibleSection>

          <LiveSheetCollapsibleSection title="Equipped">
            <CharacterEquippedSlotsPanel
              inventory={build.inventory ?? []}
              equippedSlots={build.equippedSlots ?? {}}
              characterEquipment={build.equipment}
              index={index}
              onEquipItem={(itemId, slot) => updateBuild(equipInventoryItemOnBuild(build, itemId, slot, index))}
              onUnequipItem={(itemId, slot) => updateBuild(unequipInventoryItemOnBuild(build, itemId, slot))}
            />
          </LiveSheetCollapsibleSection>

          <BuilderSidebarItemsPanel
            index={index}
            build={build}
            onEquipItem={(itemId, slot) => updateBuild(equipInventoryItemOnBuild(build, itemId, slot, index))}
            onUnequipItem={(itemId, slot) => updateBuild(unequipInventoryItemOnBuild(build, itemId, slot))}
          />

          <FloatingHoverPanel
            show={glossaryTooltipUi.showPanel && glossaryTooltipUi.hoverKey != null}
            position={glossaryTooltipUi.panelPos}
            id={BUILDER_GLOSSARY_TOOLTIP_ID}
            onMouseEnter={glossaryTooltipUi.cancelPendingClose}
            onMouseLeave={glossaryTooltipUi.leaveHover}
          >
            {glossaryTooltipUi.hoverKey ? glossaryContent(glossaryTooltipUi.hoverKey as BuilderGlossaryKey) : null}
          </FloatingHoverPanel>
        </div>
        )}
      </div>
    </div>
    </div>
    </div>
  );
}

