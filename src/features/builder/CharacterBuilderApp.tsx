import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ability,
  AsiChoices,
  CharacterBuild,
  Feat,
  HybridClassDef,
  Implement,
  Power,
  PrereqToken,
  RacialTrait,
  RulesIndex,
  Weapon
} from "../../rules/models";
import { defaultBuild } from "./defaultBuild";
import { deleteSavedCharacterById, loadBuild, loadSavedCharacters, saveBuild, saveBuildToSavedCharacters } from "./storage";
import { computeHybridDerivedStats, mergeHybridProficiencyLines, parseHybridDefenseBonuses } from "../../rules/hybridDerivedStats";
import {
  buildHybridPowerSlotDefinitions,
  hybridPowerPoolUnion,
  inferHybridClassPowerSlotsFromPowerIds,
  powerAllowedForHybridSlot,
  reconcileHybridClassPowerSlotsForBuild
} from "../../rules/hybridPowerSlots";
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
  slotBucketSectionTitle,
  upcomingClassPowerSlotMilestones
} from "../../rules/classPowerSlots";
import { getClassPowersForLevelRange, validateCharacterBuild } from "../../rules/characterValidator";
import { getDilettanteCandidatePowers, getPowersForOwnerId } from "../../rules/classPowersQuery";
import {
  autoGrantedClassPowers,
  bonusClassAtWillSlotFromRaceBuild,
  HUMAN_POWER_OPTION_RACE_KEY,
  ID_RACIAL_TRAIT_BONUS_AT_WILL,
  ID_RACIAL_TRAIT_HEROIC_EFFORT,
  ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION,
  parseFeatAssociatedPowerNames,
  racePowerGroupsForRace,
  racePowerSelectSelectionKey,
  resolvePowersByLooseNames
} from "../../rules/grantedPowersQuery";
import { evaluatePrereqs, hybridBaseClassNames } from "../../rules/prereqEvaluator";
import { applyRacialBonuses, getAbilityLabel, parseRaceAbilityBonusInfo } from "../../rules/abilityScores";
import { getRaceSecondarySelectSlots, selectableStartingLanguages } from "../../rules/raceRuleSelects";
import { parseRacialTraitIdsFromRace, resolveRacialTraitsForRace } from "../../rules/racialTraits";
import { getClassBuildOptions } from "../../rules/classBuildOptions";
import { autoGrantedTrainedSkillIds } from "../../rules/grantedSkillsQuery";
import { computeSkillSheetRows } from "../../rules/skillCalculator";
import { multiclassFeatIds } from "../../rules/multiclassDetection";
import { pruneStalePowerSelections } from "../../rules/powerSelections";
import { summarizeImplementAttack, summarizeMainWeaponAttack } from "../../rules/weaponAttack";
import { RulesRichText } from "./RulesRichText";
import { NEUTRAL_PAGE_BG } from "../../ui/tokens";
import { positionFixedTooltip } from "../../ui/glossaryTooltipPosition";
import { findCaseInsensitiveMatches, scrollTextareaToMatch } from "../../ui/jsonSearch";
import { resolveTooltipText } from "../../data/tooltipGlossary";
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

function powerCardUsageAccent(usageRaw: string): { borderLeft: string; backgroundColor: string; border: string } {
  const u = usageRaw.toLowerCase();
  if (u.includes("at-will") || u.includes("at will")) {
    return {
      borderLeft: "6px solid var(--power-accent-atwill-bar)",
      backgroundColor: "var(--power-accent-atwill-bg)",
      border: "1px solid var(--power-accent-atwill-border)"
    };
  }
  if (u.includes("encounter")) {
    return {
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)",
      border: "1px solid var(--power-accent-encounter-border)"
    };
  }
  if (u.includes("daily")) {
    return {
      borderLeft: "6px solid var(--power-accent-daily-bar)",
      backgroundColor: "var(--power-accent-daily-bg)",
      border: "1px solid var(--power-accent-daily-border)"
    };
  }
  return {
    borderLeft: "6px solid var(--panel-border)",
    backgroundColor: "var(--surface-0)",
    border: "1px solid var(--panel-border)"
  };
}

function splitPowerKeywords(rawKeywords: string): string[] {
  return rawKeywords
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

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
    keywordTooltip?: (keyword: string) => string | null;
    onKeywordMouseEnter?: (event: React.MouseEvent<HTMLElement>, keyword: string) => void;
    onKeywordMouseLeave?: () => void;
  }
): JSX.Element {
  const raw = (power.raw || {}) as Record<string, unknown>;
  const specific = (power.raw?.specific as Record<string, unknown> | undefined) || {};
  const flavor = typeof raw.flavor === "string" ? raw.flavor : "";
  const body = typeof raw.body === "string" ? raw.body : "";
  const usage = String(specific["Power Usage"] || power.usage || "-");
  const accent = powerCardUsageAccent(usage);
  const powerType = String(specific["Power Type"] || "-");
  const level = power.level ?? null;
  const display = String(specific["Display"] || power.display || "").trim();
  const keywords = String(specific["Keywords"] || power.keywords || "").trim();
  const keywordTokens = splitPowerKeywords(keywords);
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
      key={options?.key || power.id}
      style={{
        border: accent.border,
        borderLeft: accent.borderLeft,
        backgroundColor: accent.backgroundColor,
        borderRadius: "8px",
        padding: "0.55rem 0.65rem",
        marginTop: "0.45rem"
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{power.name}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {usage} {powerType !== "-" ? `• ${powerType}` : ""}
          {level != null && level > 0 ? ` • Lv ${level}` : ""}
        </div>
      </div>
      {display && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{display}</div>}
      {keywordTokens.length > 0 && (
        <div style={{ fontSize: "0.77rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
          <strong>Keywords:</strong>{" "}
          {keywordTokens.map((keyword, idx) => {
            const tooltip = options?.keywordTooltip?.(keyword) ?? null;
            const hasHoverHandlers = Boolean(options?.onKeywordMouseEnter && options?.onKeywordMouseLeave);
            return (
              <span key={`${power.id}-kw-${keyword}`}>
                <span
                  title={hasHoverHandlers ? undefined : tooltip ?? undefined}
                  onMouseEnter={hasHoverHandlers ? (event) => options?.onKeywordMouseEnter?.(event, keyword) : undefined}
                  onMouseLeave={hasHoverHandlers ? options?.onKeywordMouseLeave : undefined}
                  style={{
                    color: "var(--text-primary)",
                    cursor: hasHoverHandlers || Boolean(tooltip) ? "help" : "default",
                    textDecoration: hasHoverHandlers || Boolean(tooltip) ? "underline dotted" : "none",
                    textUnderlineOffset: "2px"
                  }}
                >
                  {keyword}
                </span>
                {idx < keywordTokens.length - 1 ? <span> </span> : null}
              </span>
            );
          })}
        </div>
      )}
      {(actionType || attackType || target || trigger || requirement) && (
        <div style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          {actionType && <div><strong>Action:</strong> {actionType}</div>}
          {attackType && <div><strong>Range/Area:</strong> {attackType}</div>}
          {target && <div><strong>Target:</strong> {target}</div>}
          {trigger && <div><strong>Trigger:</strong> {trigger}</div>}
          {requirement && <div><strong>Requirement:</strong> {requirement}</div>}
        </div>
      )}
      {(hit || miss || effect || special) && (
        <div style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
          {hit && <div><strong>Hit:</strong> {hit}</div>}
          {miss && <div><strong>Miss:</strong> {miss}</div>}
          {effect && <div><strong>Effect:</strong> {effect}</div>}
          {special && <div><strong>Special:</strong> {special}</div>}
        </div>
      )}
      {flavor && <p style={{ margin: "0.35rem 0 0 0", fontStyle: "italic", fontSize: "0.8rem", color: "var(--text-muted)" }}>{flavor}</p>}
      {body && (
        <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <RulesRichText text={body} paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-muted)" }} listItemStyle={{ fontSize: "0.8rem", color: "var(--text-muted)" }} />
        </div>
      )}
    </article>
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

function hybridRawSpecific(hybrid: HybridClassDef): Record<string, unknown> {
  return (hybrid.raw?.specific as Record<string, unknown> | undefined) || {};
}

function formatHybridStatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(x);
}

function HybridClassDetailPanel(props: {
  hybrid: HybridClassDef;
  baseClassName: string | undefined;
  slotNote: string;
}): JSX.Element {
  const spec = hybridRawSpecific(props.hybrid);
  const h = props.hybrid;
  const hpAt1Raw = spec["Hit Points at 1st Level"];
  const hpAt1Display =
    typeof hpAt1Raw === "string" && String(hpAt1Raw).trim()
      ? String(hpAt1Raw)
      : h.hitPointsAt1 != null
        ? `${h.hitPointsAt1} + Constitution score`
        : "—";
  const hpPerRaw = spec["Hit Points per Level Gained"];
  const hpPerDisplay =
    typeof hpPerRaw === "string" && String(hpPerRaw).trim()
      ? String(hpPerRaw)
      : formatHybridStatNumber(h.hitPointsPerLevel ?? null);
  const surgesRaw = spec["Healing Surges"];
  const surgesDisplay =
    typeof surgesRaw === "string" && String(surgesRaw).trim()
      ? String(surgesRaw)
      : formatHybridStatNumber(h.healingSurgesBase ?? null);

  const trainedSkills = spec["Trained Skills"];
  const trainedDisplay = typeof trainedSkills === "string" && trainedSkills.trim() ? trainedSkills : null;
  const body = typeof h.raw?.body === "string" ? h.raw.body : "";

  return (
    <div
      style={{
        border: "1px solid var(--panel-border)",
        borderRadius: "8px",
        padding: "0.65rem 0.75rem",
        backgroundColor: "var(--surface-1)"
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{h.name}</p>
      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        {h.source ? `Source: ${h.source} · ` : ""}
        {props.slotNote}
      </p>
      <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Base class (powers):</strong> {props.baseClassName ?? "—"}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Role:</strong> {String(h.role || spec["Role"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Power Source:</strong> {String(h.powerSource || spec["Power Source"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Key Abilities:</strong> {String(h.keyAbilities || spec["Key Abilities"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Hit Points at 1st Level:</strong> {hpAt1Display}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Hit Points per Level Gained:</strong> {hpPerDisplay}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Healing Surges (without Con):</strong> {surgesDisplay}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Bonus to Defense:</strong> {String(h.bonusToDefense || spec["Bonus to Defense"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Armor Proficiencies:</strong> {String(h.armorProficiencies || spec["Armor Proficiencies"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Weapon Proficiencies:</strong> {String(h.weaponProficiencies || spec["Weapon Proficiencies"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Implements:</strong> {String(h.implementText || spec["Implements"] || spec["Implement"] || "-")}
      </p>
      <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Class Skills:</strong> {String(h.classSkillsRaw || spec["Class Skills"] || "—")}
      </p>
      {trainedDisplay && (
        <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
          <strong>Trained Skills (text):</strong> {trainedDisplay}
        </p>
      )}
      {h.hybridTalentOptions &&
      String(h.hybridTalentOptions).trim() &&
      !(h.hybridTalentClassFeatures && h.hybridTalentClassFeatures.length > 0) ? (
        <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.45 }}>
          <strong>Hybrid Talent Options:</strong> {String(h.hybridTalentOptions)}
        </p>
      ) : null}
      {spec["Build Options"] ? (
        <details open style={{ marginTop: "0.45rem" }}>
          <summary style={detailsSummaryStyle}>Build Options</summary>
          <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <RulesRichText
              text={String(spec["Build Options"])}
              paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
              listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
            />
          </div>
        </details>
      ) : null}
      {body ? (
        <details open style={{ marginTop: "0.45rem" }}>
          <summary style={detailsSummaryStyle}>Description</summary>
          <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <RulesRichText text={body} paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }} listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

const abilities: Array<keyof CharacterBuild["abilityScores"]> = ["STR", "CON", "DEX", "INT", "WIS", "CHA"];
const PHYSICAL_ABILITIES: Ability[] = ["STR", "CON", "DEX"];
const MENTAL_ABILITIES: Ability[] = ["INT", "WIS", "CHA"];
type BuilderTab = "race" | "class" | "abilities" | "skills" | "feats" | "powers" | "paths" | "equipment" | "summary";
type BuilderGlossaryKey =
  | "race"
  | "class"
  | "level"
  | "hp"
  | "surges"
  | "surgeValue"
  | "skills"
  | "abilityScores"
  | `powerKeyword:${string}`;

const BUILDER_GLOSSARY_TOOLTIP_ID = "builder-glossary-tooltip";

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
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "1.25rem",
    alignItems: "start" as const,
    padding: "clamp(0.75rem, 1.5vw, 1.25rem)",
    minHeight: "100%",
    maxWidth: "1440px",
    margin: "0 auto",
    boxSizing: "border-box" as const,
    fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "var(--app-background, " + NEUTRAL_PAGE_BG + ")",
    color: "var(--text-primary)"
  },
  mainColumn: {
    backgroundColor: "var(--surface-0)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 12px)",
    padding: "1.25rem 1.35rem",
    boxShadow: "var(--ui-panel-shadow, 0 1px 4px rgba(15, 23, 42, 0.06))"
  },
  sidebarColumn: {
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 12px)",
    padding: "1.25rem 1.35rem",
    boxShadow: "var(--ui-panel-shadow, 0 1px 4px rgba(15, 23, 42, 0.06))"
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
  blockContent: {
    backgroundColor: "var(--surface-1)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-section-radius, 10px)",
    padding: "1rem 1.1rem"
  },
  blockInset: {
    backgroundColor: "var(--surface-2)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-panel-radius, 8px)",
    padding: "0.65rem 0.85rem"
  },
  blockSheetSection: {
    backgroundColor: "var(--surface-3)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--ui-panel-radius, 8px)",
    padding: "0.75rem 0.9rem",
    marginTop: "0.75rem"
  }
};

const pageTitleStyle: CSSProperties = {
  margin: "0 0 0.65rem 0",
  fontSize: "1.05rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 0.6rem 0",
  fontSize: "0.9rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const subsectionTitleStyle: CSSProperties = {
  margin: "0 0 0.45rem 0",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

const detailsSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

const jsonSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
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

export function CharacterBuilderApp({ index, tooltipGlossary }: Props): JSX.Element {
  const [build, setBuild] = useState<CharacterBuild>(() => loadBuild() || defaultBuild);
  const [savedCharacters, setSavedCharacters] = useState(() => loadSavedCharacters());
  const [selectedSavedCharacterId, setSelectedSavedCharacterId] = useState("");
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
  const [mainWeaponSearch, setMainWeaponSearch] = useState("");
  const [offHandWeaponSearch, setOffHandWeaponSearch] = useState("");
  const [implementSearch, setImplementSearch] = useState("");
  const [jsonSearchInput, setJsonSearchInput] = useState("");
  const [jsonSearchQuery, setJsonSearchQuery] = useState("");
  const [jsonSearchResultIdx, setJsonSearchResultIdx] = useState(0);
  const [jsonSearchJumpTick, setJsonSearchJumpTick] = useState(0);
  const [showGlossaryHoverInfo, setShowGlossaryHoverInfo] = useState(false);
  const [glossaryHoverKey, setGlossaryHoverKey] = useState<BuilderGlossaryKey | null>(null);
  const [glossaryHoverPanelPos, setGlossaryHoverPanelPos] = useState<{
    top: number;
    left: number;
    transform?: "translateY(-100%)";
  } | null>(null);
  const glossaryHoverTimerRef = useRef<number | null>(null);
  const glossaryHoverCloseTimerRef = useRef<number | null>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastHandledJsonSearchJumpTickRef = useRef(0);
  const GLOSSARY_HOVER_CLOSE_DELAY_MS = 400;
  const rulesById = useMemo(() => buildRulesIdLookup(index), [index]);

  const selectedRace = index.races.find((r) => r.id === build.raceId);
  const selectedClass = index.classes.find((c) => c.id === build.classId);
  const selectedTheme = index.themes.find((t) => t.id === build.themeId);
  const selectedParagonPath = index.paragonPaths.find((p) => p.id === build.paragonPathId);
  const selectedEpicDestiny = index.epicDestinies.find((d) => d.id === build.epicDestinyId);
  const selectedArmor = index.armors.find((a) => a.id === build.armorId);
  const selectedShield = index.armors.find((a) => a.id === build.shieldId);
  const selectedMainWeapon = (index.weapons ?? []).find((w) => w.id === build.mainWeaponId);
  const selectedOffHandWeapon = (index.weapons ?? []).find((w) => w.id === build.offHandWeaponId);
  const selectedImplement = (index.implements ?? []).find((i) => i.id === build.implementId);
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
  const classBuildOptions = useMemo(() => getClassBuildOptions(index, selectedClass), [index, selectedClass]);
  const selectedClassBuildOption = useMemo(() => {
    const id = build.classSelections?.buildOptionId || build.classSelections?.buildOption;
    if (!id) return undefined;
    return classBuildOptions.find((o) => o.id === id || o.name === id);
  }, [build.classSelections, classBuildOptions]);
  const autoGrantedSkillIds = useMemo(() => autoGrantedTrainedSkillIds(index, build), [index, build]);
  const autoGrantedSkillIdSet = useMemo(() => new Set(autoGrantedSkillIds), [autoGrantedSkillIds]);
  const expandedBuildJson = useMemo(
    () => JSON.stringify(expandJsonIds(build, rulesById), null, 2),
    [build, rulesById]
  );
  const jsonSearchMatches = useMemo(
    () => findCaseInsensitiveMatches(expandedBuildJson, jsonSearchQuery),
    [expandedBuildJson, jsonSearchQuery]
  );

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
  const displayedRacialTraitRows = racialTraitRows;
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
  const derived = useMemo(() => {
    if (isHybridBuild && selectedHybridA && selectedHybridB) {
      return computeHybridDerivedStats(
        effectiveBuild,
        selectedRace,
        selectedHybridA,
        selectedHybridB,
        selectedArmor,
        selectedShield,
        parseHybridDefenseBonuses(selectedHybridA, selectedHybridB)
      );
    }
    return computeDerivedStats(effectiveBuild, selectedRace, selectedClass, selectedArmor, selectedShield, legality.classDefenseBonuses);
  }, [
    effectiveBuild,
    selectedRace,
    selectedClass,
    selectedArmor,
    selectedShield,
    legality.classDefenseBonuses,
    isHybridBuild,
    selectedHybridA,
    selectedHybridB
  ]);

  useEffect(() => {
    setJsonSearchResultIdx(0);
  }, [jsonSearchQuery, expandedBuildJson]);

  useEffect(() => {
    if (jsonSearchJumpTick === 0) return;
    if (lastHandledJsonSearchJumpTickRef.current === jsonSearchJumpTick) return;
    lastHandledJsonSearchJumpTickRef.current = jsonSearchJumpTick;
    if (!jsonSearchQuery.trim()) return;
    if (jsonSearchMatches.length === 0) return;
    const textarea = jsonTextareaRef.current;
    if (!textarea) return;
    const safeIdx = Math.min(jsonSearchResultIdx, jsonSearchMatches.length - 1);
    const start = jsonSearchMatches[safeIdx];
    const end = start + jsonSearchQuery.trim().length;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    scrollTextareaToMatch(textarea, expandedBuildJson, start);
  }, [expandedBuildJson, jsonSearchJumpTick, jsonSearchMatches, jsonSearchQuery, jsonSearchResultIdx]);

  useEffect(() => {
    return () => {
      if (glossaryHoverTimerRef.current != null) {
        window.clearTimeout(glossaryHoverTimerRef.current);
      }
      if (glossaryHoverCloseTimerRef.current != null) {
        window.clearTimeout(glossaryHoverCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      if (glossaryHoverTimerRef.current != null) {
        window.clearTimeout(glossaryHoverTimerRef.current);
        glossaryHoverTimerRef.current = null;
      }
      if (glossaryHoverCloseTimerRef.current != null) {
        window.clearTimeout(glossaryHoverCloseTimerRef.current);
        glossaryHoverCloseTimerRef.current = null;
      }
      setShowGlossaryHoverInfo(false);
      setGlossaryHoverKey(null);
      setGlossaryHoverPanelPos(null);
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  function glossaryContent(key: BuilderGlossaryKey): JSX.Element {
    if (key.startsWith("powerKeyword:")) {
      const keyword = key.slice("powerKeyword:".length).trim();
      const resolved = resolveTooltipText({
        terms: [keyword, "Keyword"],
        glossaryByName: tooltipGlossary,
        index
      });
      if (resolved) return <div style={{ whiteSpace: "pre-wrap" }}>{resolved}</div>;
      return <div>No glossary entry found in `generated/glossary_terms.json` or `generated/rules_index.json`.</div>;
    }
    const termCandidates: Record<Exclude<BuilderGlossaryKey, `powerKeyword:${string}`>, string[]> = {
      race: [selectedRace?.name || "", "Race"],
      class: [selectedClass?.name || "", "Class"],
      level: ["Level"],
      hp: ["Hit Points", "HP"],
      surges: ["Healing Surges", "Healing Surge"],
      surgeValue: ["Surge Value", "Healing Surge Value"],
      skills: ["Skill", "Skills"],
      abilityScores: ["Ability Score", "Ability Scores"]
    };
    const resolved = resolveTooltipText({
      terms: termCandidates[key].filter(Boolean),
      glossaryByName: tooltipGlossary,
      index
    });
    if (resolved) {
      return <div style={{ whiteSpace: "pre-wrap" }}>{resolved}</div>;
    }
    return <div>No glossary entry found in `generated/glossary_terms.json` or `generated/rules_index.json`.</div>;
  }

  function cancelGlossaryHoverCloseTimer(): void {
    if (glossaryHoverCloseTimerRef.current != null) {
      window.clearTimeout(glossaryHoverCloseTimerRef.current);
      glossaryHoverCloseTimerRef.current = null;
    }
  }

  function hideGlossaryHoverNow(): void {
    cancelGlossaryHoverCloseTimer();
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
    }
    setShowGlossaryHoverInfo(false);
    setGlossaryHoverKey(null);
    setGlossaryHoverPanelPos(null);
  }

  function startGlossaryHover(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, key: BuilderGlossaryKey): void {
    cancelGlossaryHoverCloseTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    setGlossaryHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 360, maxHeightVh: 48 }));
    const switchingHoverTarget = showGlossaryHoverInfo && glossaryHoverKey !== null && glossaryHoverKey !== key;
    if (switchingHoverTarget) {
      setShowGlossaryHoverInfo(false);
    }
    setGlossaryHoverKey(key);
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
    }
    if (event.type === "focus") {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
      return;
    }
    glossaryHoverTimerRef.current = window.setTimeout(() => {
      setShowGlossaryHoverInfo(true);
      glossaryHoverTimerRef.current = null;
    }, 1200);
  }

  function leaveGlossaryHover(): void {
    cancelGlossaryHoverCloseTimer();
    glossaryHoverCloseTimerRef.current = window.setTimeout(() => {
      hideGlossaryHoverNow();
    }, GLOSSARY_HOVER_CLOSE_DELAY_MS);
  }

  function glossaryHoverA11y(key: BuilderGlossaryKey): {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (event: React.FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
    tabIndex: number;
    "aria-describedby"?: string;
  } {
    const active = showGlossaryHoverInfo && glossaryHoverKey === key;
    return {
      onMouseEnter: (event) => startGlossaryHover(event, key),
      onMouseLeave: leaveGlossaryHover,
      onFocus: (event) => startGlossaryHover(event, key),
      onBlur: leaveGlossaryHover,
      tabIndex: 0,
      "aria-describedby": active ? BUILDER_GLOSSARY_TOOLTIP_ID : undefined
    };
  }

  const skillSheetRows = useMemo(() => {
    const ids = new Set<string>([...autoGrantedSkillIds, ...build.trainedSkillIds]);
    return computeSkillSheetRows(index, build.level, effectiveAbilityScores, ids, derived.armorCheckPenalty);
  }, [index, build.level, effectiveAbilityScores, autoGrantedSkillIds, build.trainedSkillIds, derived.armorCheckPenalty]);

  function powerKeywordTooltip(keyword: string): string | null {
    return resolveTooltipText({ terms: [keyword, "Keyword"], glossaryByName: tooltipGlossary, index });
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

  const weaponsSorted = useMemo(
    () =>
      [...(index.weapons ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [index.weapons]
  );
  const implementsSorted = useMemo(
    () =>
      [...(index.implements ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [index.implements]
  );
  const mainWeaponOptions = useMemo(
    () =>
      ensureSelectedEntityInFiltered(filterRulesEntitiesByQuery(weaponsSorted, mainWeaponSearch), build.mainWeaponId, weaponsSorted),
    [weaponsSorted, mainWeaponSearch, build.mainWeaponId]
  );
  const offHandWeaponOptions = useMemo(
    () =>
      ensureSelectedEntityInFiltered(
        filterRulesEntitiesByQuery(weaponsSorted, offHandWeaponSearch),
        build.offHandWeaponId,
        weaponsSorted
      ),
    [weaponsSorted, offHandWeaponSearch, build.offHandWeaponId]
  );
  const implementOptions = useMemo(
    () =>
      ensureSelectedEntityInFiltered(filterRulesEntitiesByQuery(implementsSorted, implementSearch), build.implementId, implementsSorted),
    [implementsSorted, implementSearch, build.implementId]
  );
  const mainWeaponSummary = useMemo(
    () => summarizeMainWeaponAttack(build.level, effectiveAbilityScores, selectedMainWeapon, classWeaponProfText),
    [build.level, effectiveAbilityScores, selectedMainWeapon, classWeaponProfText]
  );
  const offHandWeaponSummary = useMemo(
    () => summarizeMainWeaponAttack(build.level, effectiveAbilityScores, selectedOffHandWeapon, classWeaponProfText),
    [build.level, effectiveAbilityScores, selectedOffHandWeapon, classWeaponProfText]
  );
  const implementAttackSummary = useMemo(
    () =>
      summarizeImplementAttack(
        build.level,
        effectiveAbilityScores,
        hybridBaseClassDefA || selectedClass,
        selectedImplement,
        classImplementProfText
      ),
    [build.level, effectiveAbilityScores, hybridBaseClassDefA, selectedClass, selectedImplement, classImplementProfText]
  );
  const multiclassFeatIdList = useMemo(() => multiclassFeatIds(index, build), [index, build]);

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
  const dilettanteCandidatePowers = useMemo(() => {
    const cid = hybridBaseClassAId || build.classId;
    return getDilettanteCandidatePowers(index, cid, isHybridBuild ? hybridBaseClassBId : undefined);
  }, [index, build.classId, hybridBaseClassAId, hybridBaseClassBId, isHybridBuild]);
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
    if (nextBase.characterStyle === "hybrid") {
      const ha = index.hybridClasses?.find((h) => h.id === nextBase.hybridClassIdA);
      const hb = index.hybridClasses?.find((h) => h.id === nextBase.hybridClassIdB);
      return reconcileHybridClassPowerSlotsForBuild(nextBase, lv, bonus, index, ha?.baseClassId ?? undefined, hb?.baseClassId ?? undefined);
    }
    return reconcileClassPowerSlotsForBuild(nextBase, lv, bonus, index);
  }

  const humanPowerExtraTraitIds = useMemo(() => {
    const top = parseRacialTraitIdsFromRace(selectedRace);
    if (!top.includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION)) return [];
    const pick = build.raceSelections?.[HUMAN_POWER_OPTION_RACE_KEY];
    if (pick === ID_RACIAL_TRAIT_HEROIC_EFFORT) return [ID_RACIAL_TRAIT_HEROIC_EFFORT];
    return [];
  }, [selectedRace, build.raceSelections]);
  const powerSlotDefs = useMemo(() => {
    if (isHybridBuild) return buildHybridPowerSlotDefinitions(build.level, bonusClassAtWill);
    return buildClassPowerSlotDefinitions(build.level, bonusClassAtWill);
  }, [build.level, bonusClassAtWill, isHybridBuild]);
  const racePowerGroups = useMemo(
    () =>
      racePowerGroupsForRace(selectedRace, racialTraitById, [
        ...humanPowerExtraTraitIds
      ]),
    [selectedRace, racialTraitById, humanPowerExtraTraitIds]
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
  const maxAdditionalTrainedSkills = legality.classSkillRules?.chooseAdditionalCount ?? 0;
  const trainedSkillSelectionMaxed = trainedOptionalClassSkillCount >= maxAdditionalTrainedSkills;
  const hybridPrereqOptions = useMemo(
    () => ({ additionalClassNamesForMatch: hybridBaseClassNames(index, build) }),
    [index, build.characterStyle, build.hybridClassIdA, build.hybridClassIdB]
  );

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
    const ev = evaluatePrereqs(tokens, build, raceNameById, classNameById, skillNameById, hybridPrereqOptions);
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
    if (m.startsWith("power:")) return "powers";
    if (m.includes("hybrid class")) return "class";
    if (m.includes("hybrid talent")) return "class";
    if (m.includes("point-buy") || m.includes("ability increases")) return "abilities";
    if (m.includes("ability") || m.includes("score")) return "abilities";
    if (m.includes("trained") || m.includes("skill")) return "skills";
    if (m.includes("feat")) return "feats";
    if (m.includes("utility power")) return "powers";
    if (m.includes("at-will") || m.includes("encounter") || m.includes("daily") || m.includes("power")) return "powers";
    if (m.includes("armor") || m.includes("shield") || m.includes("proficiency")) return "equipment";
    if (m.includes("main weapon") || m.includes("off-hand weapon") || m.includes("selected implement")) return "equipment";
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
    const classReady = isHybridBuild ? hybridClassSelectionComplete : !!selectedClass;
    const statuses: Record<BuilderTab, "complete" | "incomplete"> = {
      race: !!selectedRace && errorsByTab.race === 0 ? "complete" : "incomplete",
      class: classReady && errorsByTab.class === 0 ? "complete" : "incomplete",
      abilities:
        errorsByTab.abilities === 0 &&
        pointBuy.remaining >= 0 &&
        pointBuy.invalidScores.length === 0 &&
        !requiresRacialChoice
          ? "complete"
          : "incomplete",
      skills: classReady && errorsByTab.skills === 0 ? "complete" : "incomplete",
      feats:
        errorsByTab.feats === 0 && build.featIds.length === expectedFeatCount ? "complete" : "incomplete",
      powers: classReady && errorsByTab.powers === 0 ? "complete" : "incomplete",
      paths: errorsByTab.paths === 0 ? "complete" : "incomplete",
      equipment: errorsByTab.equipment === 0 ? "complete" : "incomplete",
      summary: legality.errors.length === 0 ? "complete" : "incomplete"
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
    const pruned = pruneStalePowerSelections(index, next);
    setBuild(pruned);
    saveBuild(pruned);
  }

  function refreshSavedCharacters(): void {
    setSavedCharacters(loadSavedCharacters());
  }

  function renderPowerCardWithSelections(p: Power, cardKey: string): JSX.Element {
    return (
      <div key={cardKey}>
        {renderPowerCard(p, {
          key: `${cardKey}-card`,
          keywordTooltip: powerKeywordTooltip,
          onKeywordMouseEnter: (event, keyword) => startGlossaryHover(event, `powerKeyword:${keyword}`),
          onKeywordMouseLeave: leaveGlossaryHover
        })}
        <PowerConstructionSelects power={p} build={build} onChange={updateBuild} />
      </div>
    );
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

  function commitClassPowerSlot(slotKey: string, powerId: string): void {
    const defs = powerSlotDefs;
    const prevId = build.classPowerSlots?.[slotKey];
    const nextSlots: Record<string, string> = { ...(build.classPowerSlots || {}) };
    if (powerId) nextSlots[slotKey] = powerId;
    else delete nextSlots[slotKey];
    const trimmed = Object.keys(nextSlots).length ? nextSlots : undefined;
    let nextBuild: CharacterBuild = {
      ...build,
      classPowerSlots: trimmed,
      powerIds: orderedPowerIdsFromSlots(defs, trimmed)
    };
    if (prevId && prevId !== powerId && nextBuild.powerSelections?.[prevId]) {
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
        defs = buildHybridPowerSlotDefinitions(prev.level, bonus);
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
      <div style={ui.mainColumn}>
        <h1 style={pageTitleStyle}>D&amp;D 4e Character Builder</h1>
        <div style={ui.blockTitle}>
          <label style={{ display: "block", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            Character Name
            <input
              value={build.name}
              onChange={(e) => updateBuild({ ...build, name: e.target.value })}
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
          <label style={{ display: "block", marginTop: "0.65rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
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
                const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, lv);
                updateBuild({ ...nextBase, classPowerSlots, powerIds });
              }}
              style={{
                width: "4.75rem",
                marginTop: "0.25rem",
                padding: "0.4rem 0.5rem",
                border: "1px solid var(--panel-border)",
                borderRadius: "6px",
                backgroundColor: "var(--surface-0)",
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
                  border: activeTab === id ? "1px solid var(--panel-border-strong)" : "1px solid var(--panel-border)",
                  background: activeTab === id ? "var(--surface-2)" : "var(--surface-1)",
                  color: "var(--text-primary)",
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
                    color: tabStatuses[id as BuilderTab] === "complete" ? "var(--status-success)" : "var(--text-muted)",
                    marginTop: "0.12rem"
                  }}
                >
                  {renderTabStatus(tabStatuses[id as BuilderTab])}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={ui.blockSheetSection}>
          <h4 style={subsectionTitleStyle}>Validation Notes</h4>
          {legality.warnings.length > 0 && (
            <ul style={{ margin: "0 0 0.5rem 0", paddingLeft: "1.2rem", color: "var(--status-warning)", fontSize: "0.88rem" }}>
              {legality.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {featOptions
              .filter((f) => !f.legal && build.featIds.includes(f.item.id))
              .flatMap((f) => f.reasons.map((r) => `${f.item.name}: ${r}`))
              .map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(mapErrorToTab(r))}
                    style={{ border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", padding: 0, color: "var(--text-secondary)" }}
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
                  style={{ border: "none", background: "transparent", textDecoration: "underline", cursor: "pointer", padding: 0, color: "var(--text-secondary)" }}
                >
                  {e}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={ui.blockContent}>
        {activeTab === "race" && (
          <div>
            <h3 style={sectionTitleStyle}>Race</h3>
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
              (raceAbilityBonusInfo.chooseOne.length > 0 ||
                raceSecondarySlots.length > 0 ||
                racePowerGroups.some((g) => g.choiceOnly) ||
                parseRacialTraitIdsFromRace(selectedRace).includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION)) && (
                <div style={{ marginTop: "0.65rem", ...ui.blockInset, backgroundColor: "var(--surface-1)", borderColor: "var(--panel-border)" }}>
                  <h4 style={subsectionTitleStyle}>Race choices</h4>
                  {parseRacialTraitIdsFromRace(selectedRace).includes(ID_RACIAL_TRAIT_HUMAN_POWER_SELECTION) && (
                    <label style={{ display: "block", marginBottom: "0.75rem" }}>
                      <span style={{ display: "block", fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.85rem" }}>
                        Human power option
                      </span>
                      <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                        PHB-style characters use the third class at-will slot (default below). Pick{" "}
                        <strong>Heroic Effort</strong> only if you use the Essentials option instead of that third at-will.
                      </p>
                      <select
                        value={build.raceSelections?.[HUMAN_POWER_OPTION_RACE_KEY] || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const next = { ...(build.raceSelections || {}) };
                          if (v) next[HUMAN_POWER_OPTION_RACE_KEY] = v;
                          else delete next[HUMAN_POWER_OPTION_RACE_KEY];
                          const keys = Object.keys(next);
                          const nextBase: CharacterBuild = {
                            ...build,
                            raceSelections: keys.length ? next : undefined
                          };
                          const { classPowerSlots, powerIds } = reconcilePowerSlotsForBuild(nextBase, build.level);
                          updateBuild({ ...nextBase, classPowerSlots, powerIds });
                        }}
                        style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
                      >
                        <option value="">Third class at-will (PHB-style default)</option>
                        <option value={ID_RACIAL_TRAIT_BONUS_AT_WILL}>Bonus At-Will Power (same as default)</option>
                        <option value={ID_RACIAL_TRAIT_HEROIC_EFFORT}>Heroic Effort (Essentials — no third at-will)</option>
                      </select>
                    </label>
                  )}
                  {racePowerGroups
                    .filter((g) => g.choiceOnly)
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
                        style={{ width: "100%", maxWidth: "28rem", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
                </div>
              )}
            {selectedRace && (
              <div style={{ ...ui.blockInset, marginTop: "0.65rem" }}>
                <p style={{ margin: 0 }}><strong>Source:</strong> {selectedRace.source || "Unknown"}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Speed:</strong> {String(raceSpecific["Speed"] || selectedRace.speed || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Size:</strong> {String(raceSpecific["Size"] || selectedRace.size || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Ability Scores:</strong> {String(raceSpecific["Ability Scores"] || selectedRace.abilitySummary || "-")}</p>
                <p style={{ margin: "0.25rem 0 0 0" }}><strong>Languages:</strong> {String(raceSpecific["Languages"] || selectedRace.languages || "-")}</p>
                {displayedRacialTraitRows.length > 0 && (
                  <div style={{ marginTop: "0.65rem" }}>
                    <h4 style={subsectionTitleStyle}>Racial traits</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      {displayedRacialTraitRows.map(({ id, trait }) => (
                        <details
                          key={id}
                          style={{
                            backgroundColor: "var(--surface-1)",
                            border: "1px solid var(--panel-border)",
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
                              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> — {trait.shortDescription}</span>
                            ) : null}
                          </summary>
                          <div style={{ marginTop: "0.4rem", fontSize: "0.86rem", lineHeight: 1.45 }}>
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
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                {racePowerGroups.some((g) => g.powerIds.length > 0 || g.dilettantePick) && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={subsectionTitleStyle}>Granted powers</h4>
                    {racePowerGroups
                      .filter((g) => g.powerIds.length > 0 || g.dilettantePick)
                      .map((g) => {
                        const pickKey = racePowerSelectSelectionKey(g.traitId);
                        const selectedPowId = build.raceSelections?.[pickKey] || "";
                        const optionPowers = g.dilettantePick
                          ? dilettanteCandidatePowers
                          : g.powerIds
                              .map((pid) => index.powers.find((p) => p.id === pid))
                              .filter((p): p is Power => !!p);
                        return (
                          <div key={`race-powers-${g.traitId}`} style={{ marginBottom: "0.55rem" }}>
                            <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                              <strong>{g.traitName}</strong>
                              {g.choiceOnly && g.dilettantePick
                                ? " — Dilettante: choose a 1st-level at-will attack from another class (you use it as an encounter power)."
                                : g.choiceOnly
                                  ? " — choose one racial power below."
                                  : ""}
                            </p>
                            {g.dilettantePick && !classIdForDilettante ? (
                              <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.82rem", color: "var(--status-warning)" }}>
                                Choose a standard class or two hybrid classes on the Class tab to load powers from other classes.
                              </p>
                            ) : null}
                            <div>
                              {g.choiceOnly ? (
                                selectedPowId ? (
                                  (() => {
                                    const p = index.powers.find((x) => x.id === selectedPowId);
                                    return p ? (
                                      renderPowerCard(p, {
                                        key: `race-tab-${g.traitId}-${p.id}`,
                                        keywordTooltip: powerKeywordTooltip,
                                        onKeywordMouseEnter: (event, keyword) => startGlossaryHover(event, `powerKeyword:${keyword}`),
                                        onKeywordMouseLeave: leaveGlossaryHover
                                      })
                                    ) : (
                                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--status-warning)" }}>
                                        Stored power id is unknown in the index.
                                      </p>
                                    );
                                  })()
                                ) : (
                                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>Pick a power in Race choices.</p>
                                )
                              ) : (
                                optionPowers.map((p) =>
                                  renderPowerCard(p, {
                                    key: `race-tab-${g.traitId}-${p.id}`,
                                    keywordTooltip: powerKeywordTooltip,
                                    onKeywordMouseEnter: (event, keyword) => startGlossaryHover(event, `powerKeyword:${keyword}`),
                                    onKeywordMouseLeave: leaveGlossaryHover
                                  })
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                    <summary style={detailsSummaryStyle}>Lore Overview</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(selectedRace.raw.body)} />
                    </div>
                  </details>
                )}
                {raceSpecific["Physical Qualities"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary style={detailsSummaryStyle}>Physical Qualities</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(raceSpecific["Physical Qualities"])} />
                    </div>
                  </details>
                )}
                {raceSpecific["Playing"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary style={detailsSummaryStyle}>Playing This Race</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(raceSpecific["Playing"])} />
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "class" && (
          <div>
            <h3 style={sectionTitleStyle}>Class</h3>
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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
                {hybridClassSelectionComplete && classAutoGrantedPowers.length > 0 && (
                  <div
                    style={{
                      ...ui.blockInset,
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
                    <summary style={detailsSummaryStyle}>Class Lore Overview</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(selectedClass.raw.body)} />
                    </div>
                  </details>
                )}
                {classSpecific["Build Options"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary style={detailsSummaryStyle}>Build Options</summary>
                    <div style={{ marginTop: "0.4rem" }}>
                      <RulesRichText text={String(classSpecific["Build Options"])} />
                    </div>
                  </details>
                )}
                {classAutoGrantedPowers.length > 0 && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <h4 style={subsectionTitleStyle}>Granted powers</h4>
                    {classAutoGrantedPowers.map((p) => renderPowerCardWithSelections(p, `class-tab-${p.id}`))}
                  </div>
                )}
                {classBuildOptions.length > 0 && (
                  <div style={{ marginTop: "0.85rem", paddingTop: "0.75rem", borderTop: "1px solid var(--panel-border)" }}>
                    <h4 style={subsectionTitleStyle}>Class choices</h4>
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
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
                        <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                          <strong>Selected:</strong> {selectedClassBuildOption.name}
                        </p>
                        {selectedClassBuildOption.shortDescription && (
                          <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            {selectedClassBuildOption.shortDescription}
                          </p>
                        )}
                        {selectedClassBuildOption.body && (
                          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            <RulesRichText
                              text={selectedClassBuildOption.body}
                              paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
                              listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
                            />
                          </div>
                        )}
                        {selectedClassBuildOption.powerIds.length > 0 && (
                          <div style={{ marginTop: "0.45rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Granted powers</div>
                            {selectedClassBuildOption.powerIds
                              .map((pid) => index.powers.find((p) => p.id === pid))
                              .filter((p): p is Power => !!p)
                              .map((p) => renderPowerCardWithSelections(p, `class-build-${selectedClassBuildOption.id}-${p.id}`))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {classSpecific["Role"] && (
                  <details open style={{ marginTop: "0.4rem" }}>
                    <summary style={detailsSummaryStyle}>Role Details</summary>
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
            <h3 style={sectionTitleStyle}>Ability Scores</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.45 }}>
              Set <strong>base</strong> scores (8–18) using point buy. Modifiers below use your <strong>final</strong> score after level-based increases, then racial bonuses—those are what checks and attacks use.
            </p>

            {build.level >= 11 && (
              <p style={{ ...ui.blockInset, marginBottom: "0.75rem", backgroundColor: "var(--surface-2)", fontSize: "0.88rem", color: "var(--text-primary)" }}>
                <strong>PHB tier bumps:</strong> At 11th level and 21st level, each ability score gains +1 automatically (included below). At 4, 8, 14, 18, 24, and 28, assign two different +1s in{" "}
                <strong>Level-up ability increases</strong>.
              </p>
            )}

            {(raceAbilityBonusInfo.fixed.length > 0 || raceAbilityBonusInfo.chooseOne.length > 0) && (
              <div
                style={{
                  ...ui.blockInset,
                  marginBottom: "0.75rem",
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
              <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "var(--surface-1)" }}>
                <h4 style={subsectionTitleStyle}>Level-up ability increases</h4>
                <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
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
                            style={{ display: "block", marginTop: "0.2rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
                            style={{ display: "block", marginTop: "0.2rem", padding: "0.3rem 0.4rem", borderRadius: "6px", border: "1px solid var(--panel-border)" }}
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
              <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "var(--surface-1)" }}>
                {build.level >= 11 && (
                  <div style={{ marginBottom: build.level >= 21 ? "0.55rem" : 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.88rem" }}>Paragon Tier</div>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>All ability scores increase by +1 automatically.</p>
                  </div>
                )}
                {build.level >= 21 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.88rem" }}>Epic Tier</div>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)" }}>All ability scores increase by +1 automatically.</p>
                  </div>
                )}
              </section>
            )}

            <section style={{ ...ui.blockInset, marginBottom: "0.85rem", backgroundColor: "var(--surface-1)", borderColor: "var(--panel-border)" }}>
              <div style={{ marginBottom: "0.55rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
                Point-Buy Budget
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "0.75rem 1rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", width: "fit-content" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Budget</span>
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
                      border: "1px solid var(--panel-border-strong)",
                      backgroundColor: "var(--surface-0)",
                      fontWeight: 600
                    }}
                  />
                </label>
                <div style={{ flex: "1 1 14rem", display: "grid", gap: "0.35rem" }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <strong style={{ color: "var(--text-secondary)" }}>Points spent:</strong>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pointBuy.total}</span>
                    <span style={{ color: "var(--text-muted)" }}>/</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{pointBuy.budget}</span>
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      color: pointBuy.remaining < 0 ? "crimson" : pointBuy.remaining === 0 ? "var(--status-success)" : "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem"
                    }}
                  >
                    <strong style={{ color: "var(--text-secondary)" }}>Remaining:</strong>
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
                backgroundColor: "var(--surface-1)",
                borderColor: "var(--panel-border)"
              }}
            >
              {(
                [
                  { title: "Physical", list: PHYSICAL_ABILITIES },
                  { title: "Mental", list: MENTAL_ABILITIES }
                ] as const
              ).map(({ title, list }) => (
                <div key={title} style={{ backgroundColor: "var(--surface-0)", border: "1px solid var(--panel-border)", borderRadius: "8px", padding: "0.5rem 0.65rem" }}>
                  <h4
                    style={{
                      margin: "0 0 0.45rem 0",
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid var(--panel-border)",
                      paddingBottom: "0.3rem"
                    }}
                  >
                    {title}
                  </h4>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "0.86rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--panel-border)" }}>
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
                              <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 400 }}>{getAbilityLabel(ability)}</span>
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
                                  border: "1px solid var(--panel-border)",
                                  borderRadius: "6px",
                                  backgroundColor: "var(--surface-0)",
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

            <details style={{ ...ui.blockInset, marginTop: "1rem", backgroundColor: "var(--surface-0)" }}>
              <summary style={detailsSummaryStyle}>What do these abilities mean?</summary>
              <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {abilities.map((ability) => {
                  const lore = abilityLoreByCode.get(ability);
                  if (!lore) return null;
                  return (
                    <div key={ability}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>
                        {ability} — {getAbilityLabel(ability)}
                      </p>
                      <div style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        <RulesRichText text={lore} paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }} listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }} />
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
            <h3 style={sectionTitleStyle}>Skills</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.45 }}>
              All skills are listed. You can only <strong>train</strong> skills from your class list (checkbox enabled). Other skills are shown for reference.
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
            <div style={{ ...ui.blockInset, backgroundColor: "var(--surface-1)" }}>
              {skillsSortedAll.map((skill) => {
                const checked = build.trainedSkillIds.includes(skill.id);
                const trainable = !!(selectedClass && selectedClassSkillNamesLower.has(skill.name.toLowerCase()));
                const autoGranted = autoGrantedSkillIdSet.has(skill.id);
                const requiredSkill = requiredClassSkillNamesLower.has(skill.name.toLowerCase());
                const disableBecauseMaxed = trainedSkillSelectionMaxed && !checked && trainable && !requiredSkill;
                const canInteract = (trainable || checked) && !autoGranted && !disableBecauseMaxed;
                const skillBody = typeof skill.raw?.body === "string" ? skill.raw.body : "";
                const skillScore = calculateSkillScore(build, effectiveAbilityScores, skill.keyAbility, checked);
                return (
                  <div
                    key={skill.id}
                    style={{
                      marginBottom: "0.35rem",
                      opacity: trainable || checked ? (disableBecauseMaxed ? 0.58 : 1) : 0.72
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
                      <span style={{ marginLeft: "0.4rem", fontSize: "0.84rem", color: "var(--text-primary)", fontWeight: 600 }}>
                        {skillScore === null ? "Score —" : `Score ${formatAbilityMod(skillScore)}`}
                      </span>
                      {autoGranted && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "var(--status-success)", fontWeight: 600 }}>
                          — auto trained
                        </span>
                      )}
                      {!trainable && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 400 }}>
                          {selectedClass ? "— not on class list" : ""}
                        </span>
                      )}
                      {disableBecauseMaxed && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                          — max trained selected
                        </span>
                      )}
                      {checked && !trainable && selectedClass && (
                        <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "var(--status-danger)", fontWeight: 600 }}>
                          (clear — not a class skill)
                        </span>
                      )}
                    </label>
                    {skillBody && (
                      <details open style={{ marginLeft: "1.25rem", marginTop: "0.15rem" }}>
                        <summary style={detailsSummaryStyle}>Description</summary>
                        <div style={{ fontSize: "0.8rem", margin: "0.25rem 0 0 0", color: "var(--text-secondary)" }}>
                          <RulesRichText text={skillBody} paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-secondary)" }} listItemStyle={{ fontSize: "0.8rem", color: "var(--text-secondary)" }} />
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
            <h3 style={sectionTitleStyle}>Feat Selection</h3>
            <p style={{ margin: "0.25rem 0 0.5rem 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
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
                  border: "1px solid var(--panel-border)",
                  borderRadius: "6px",
                  boxSizing: "border-box"
                }}
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.55rem" }}>
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Tier
                <select
                  value={featTierFilter}
                  onChange={(e) => setFeatTierFilter(e.target.value as "all" | "HEROIC" | "PARAGON" | "EPIC")}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "8.5rem", padding: "0.35rem", border: "1px solid var(--panel-border)", borderRadius: "6px" }}
                >
                  <option value="all">All tiers</option>
                  <option value="HEROIC">Heroic</option>
                  <option value="PARAGON">Paragon</option>
                  <option value="EPIC">Epic</option>
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Category
                <select
                  value={featCategoryFilter}
                  onChange={(e) => setFeatCategoryFilter(e.target.value)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "10rem", padding: "0.35rem", border: "1px solid var(--panel-border)", borderRadius: "6px" }}
                >
                  <option value="all">All categories</option>
                  {featCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Source
                <select
                  value={featSourceFilter}
                  onChange={(e) => setFeatSourceFilter(e.target.value)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "11rem", padding: "0.35rem", border: "1px solid var(--panel-border)", borderRadius: "6px" }}
                >
                  <option value="all">All sources</option>
                  {featSourceOptions.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Sort
                <select
                  value={featSortMode}
                  onChange={(e) => setFeatSortMode(e.target.value as FeatSortMode)}
                  style={{ display: "block", marginTop: "0.2rem", minWidth: "11rem", padding: "0.35rem", border: "1px solid var(--panel-border)", borderRadius: "6px" }}
                >
                  <option value="tier-alpha">Tier, then name</option>
                  <option value="alpha">Name (A-Z)</option>
                  <option value="source-alpha">Source, then name</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.45rem" }}>
              <button type="button" onClick={() => updateBuild({ ...build, featIds: [] })} style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--panel-border)", background: "var(--surface-0)", cursor: "pointer" }}>
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
                style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid var(--panel-border)", background: "var(--surface-0)", cursor: "pointer" }}
              >
                Reset feat filters
              </button>
            </div>
            <div style={{ ...ui.blockInset, maxHeight: "280px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
              {filteredFeatRows.length === 0 ? (
                <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
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
                          <span style={{ fontWeight: selected ? 600 : 500 }}>
                            {opt.item.name}
                            {invalid && (
                              <span style={{ marginLeft: "0.35rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--status-warning)" }}>Invalid</span>
                            )}
                          </span>
                          <span style={{ display: "block", marginTop: "0.2rem" }}>
                            {featTier && (
                              <span style={{ display: "inline-block", marginRight: "0.3rem", padding: "0.08rem 0.35rem", borderRadius: "999px", fontSize: "0.7rem", background: "var(--surface-2)", color: "var(--text-secondary)", fontWeight: 600 }}>
                                {featTier}
                              </span>
                            )}
                            <span style={{ display: "inline-block", marginRight: "0.3rem", padding: "0.08rem 0.35rem", borderRadius: "999px", fontSize: "0.7rem", background: "var(--surface-2)", color: "var(--status-info)", fontWeight: 600 }}>
                              {featCategory}
                            </span>
                          </span>
                          {opt.item.source && (
                            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>{opt.item.source}</span>
                          )}
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
            <div style={{ ...ui.blockInset, marginTop: "0.75rem", backgroundColor: "var(--surface-1)" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "0.3rem" }}>Selected Feats</div>
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
                    const tier = String(f.tier || "").trim();
                    return (
                      <article
                        key={f.id}
                        style={{
                          border: "1px solid var(--panel-border)",
                          borderRadius: "8px",
                          backgroundColor: "var(--surface-0)",
                          padding: "0.45rem 0.55rem"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "var(--text-primary)" }}>{f.name}</div>
                          <button
                            type="button"
                            onClick={() => updateBuild({ ...build, featIds: build.featIds.filter((id) => id !== f.id) })}
                            style={{
                              fontSize: "0.72rem",
                              lineHeight: 1.1,
                              padding: "0.16rem 0.4rem",
                              borderRadius: "999px",
                              border: "1px solid #f3c6c6",
                              backgroundColor: "var(--surface-0)",
                              color: "var(--status-danger)",
                              cursor: "pointer",
                              fontWeight: 700
                            }}
                            aria-label={`Remove feat ${f.name}`}
                            title="Remove feat"
                          >
                            Remove
                          </button>
                        </div>
                        <div style={{ marginTop: "0.18rem", display: "flex", flexWrap: "wrap", gap: "0.3rem 0.45rem", alignItems: "center" }}>
                          {f.source ? (
                            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", backgroundColor: "var(--surface-1)", border: "1px solid var(--panel-border)", borderRadius: "999px", padding: "0.06rem 0.38rem" }}>
                              {f.source}
                            </span>
                          ) : null}
                          {tier ? (
                            <span style={{ fontSize: "0.72rem", color: "var(--status-info)", backgroundColor: "var(--surface-2)", border: "1px solid var(--panel-border)", borderRadius: "999px", padding: "0.06rem 0.38rem", fontWeight: 600 }}>
                              {tier}
                            </span>
                          ) : null}
                        </div>
                        {summary && (
                          <div style={{ marginTop: "0.28rem", color: "var(--text-secondary)", fontSize: "0.79rem", lineHeight: 1.4 }}>
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
            <h3 style={sectionTitleStyle}>Power Selection</h3>
            <p style={{ margin: "0.25rem 0 0.65rem 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
              Each <strong>class</strong> slot is a separate choice. The list for a slot only includes <strong>class</strong> powers whose{" "}
              <strong>printed level</strong> is at most that slot&apos;s gain level (for example, the 3rd-level encounter slot only lists encounter
              attacks of printed level 3 or lower). Search filters the lists. Paragon path and epic destiny powers are shown below when you have
              selected them on the Paths tab; they are extra powers on top of your class schedule, not chosen into these class slots.
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
            {(racePowerGroups.some((g) => g.powerIds.length > 0 || g.dilettantePick) ||
              classAutoGrantedPowers.length > 0 ||
              featAssociatedPowers.length > 0 ||
              themeGrantedPowers.length > 0 ||
              paragonPathGrantedPowers.length > 0 ||
              epicDestinyGrantedPowers.length > 0) && (
              <section style={{ marginBottom: "1.1rem", padding: "0.65rem 0.75rem", backgroundColor: "var(--surface-1)", borderRadius: "8px", border: "1px solid var(--panel-border)" }}>
                {racePowerGroups.some((g) => g.powerIds.length > 0 || g.dilettantePick) && (
                  <div style={{ marginBottom: "0.65rem" }}>
                    <div>
                      {racePowerGroups
                        .filter((g) => g.powerIds.length > 0 || g.dilettantePick)
                        .map((g) => {
                          const pickKey = racePowerSelectSelectionKey(g.traitId);
                          const selectedPowId = build.raceSelections?.[pickKey] || "";
                          const optionPowers = g.dilettantePick
                            ? filterPowersByQuery(dilettanteCandidatePowers, powerSearch)
                            : g.powerIds
                                .map((pid) => index.powers.find((p) => p.id === pid))
                                .filter((p): p is Power => !!p);
                          let selectOptions = optionPowers;
                          if (selectedPowId && !selectOptions.some((p) => p.id === selectedPowId)) {
                            const orphan = index.powers.find((p) => p.id === selectedPowId);
                            if (orphan) selectOptions = [orphan, ...selectOptions];
                          }
                          return (
                            <div key={g.traitId} style={{ marginBottom: "0.35rem" }}>
                              <span style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)" }}>{g.traitName}</span>
                              {g.choiceOnly && g.dilettantePick ? (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                  {" "}
                                  — Dilettante (1st at-will from another class; search above filters this list):
                                </span>
                              ) : g.choiceOnly ? (
                                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}> — pick one (same as Race tab):</span>
                              ) : null}
                              {g.dilettantePick && !classIdForDilettante ? (
                                <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.78rem", color: "var(--status-warning)" }}>
                                  Choose a standard class or hybrid classes on the Class tab to load other classes&apos; at-will powers.
                                </p>
                              ) : null}
                              {g.choiceOnly && (
                                <label style={{ display: "block", maxWidth: "28rem", marginTop: "0.35rem" }}>
                                  <select
                                    value={selectedPowId}
                                    disabled={g.dilettantePick && !classIdForDilettante}
                                    onChange={(e) => commitRacePowerSelection(g.traitId, e.target.value)}
                                    style={{
                                      width: "100%",
                                      padding: "0.35rem",
                                      borderRadius: "6px",
                                      border: "1px solid var(--panel-border)",
                                      boxSizing: "border-box",
                                      fontSize: "0.82rem"
                                    }}
                                  >
                                    <option value="">— Choose racial power —</option>
                                    {selectOptions.map((p) => {
                                      const clsName = index.classes.find((c) => c.id === p.classId)?.name || "";
                                      return (
                                        <option key={p.id} value={p.id}>
                                          {clsName ? `${clsName}: ` : ""}
                                          {p.name}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </label>
                              )}
                              {g.choiceOnly && g.dilettantePick && build.classId && selectOptions.length === 0 && powerSearch.trim() ? (
                                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.76rem", color: "var(--status-warning)" }}>
                                  No powers match this filter; clear search to see the full Dilettante list.
                                </p>
                              ) : null}
                              <div style={{ marginTop: "0.2rem" }}>
                                {g.choiceOnly ? (
                                  selectedPowId ? (
                                    (() => {
                                      const p = index.powers.find((x) => x.id === selectedPowId);
                                      return p ? (
                                        renderPowerCardWithSelections(p, `race-${g.traitId}-${p.id}`)
                                      ) : (
                                        <div key={selectedPowId}>{selectedPowId}</div>
                                      );
                                    })()
                                  ) : (
                                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>No racial power chosen yet.</span>
                                  )
                                ) : (
                                  g.powerIds.map((pid) => {
                                    const p = index.powers.find((x) => x.id === pid);
                                    return p ? renderPowerCardWithSelections(p, `race-${g.traitId}-${p.id}`) : <div key={pid}>{pid}</div>;
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                {featAssociatedPowers.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>Feats you selected</div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {featAssociatedPowers.map(({ feat, powers }) => (
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
                        <h4 style={{ ...subsectionTitleStyle, marginBottom: "0.5rem", borderBottom: "1px solid var(--panel-border)", paddingBottom: "0.25rem" }}>
                          {slotBucketSectionTitle(def.bucket)}
                        </h4>
                      )}
                      <div style={{ ...ui.blockInset, backgroundColor: "var(--surface-1)", padding: "0.65rem 0.75rem" }}>
                        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-primary)" }}>
                          {def.label}
                        </label>
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
                        {selPow && (
                          <div style={{ marginTop: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Selected power card</div>
                            {renderPowerCardWithSelections(selPow, `slot-${def.key}-${selPow.id}`)}
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
            <h3 style={sectionTitleStyle}>Theme, paragon path, and epic destiny</h3>
            <p style={{ margin: "0.25rem 0 0.75rem 0", color: "var(--text-muted)", fontSize: "0.88rem", lineHeight: 1.45 }}>
              Themes are optional packages with prerequisites. Paragon paths require <strong>level 11+</strong>; epic destinies require{" "}
              <strong>level 21+</strong>. Dropping level clears a path or destiny that is no longer legal.
            </p>

            <section style={{ marginBottom: "1.25rem" }}>
              <h4 style={subsectionTitleStyle}>Theme</h4>
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
              <div style={{ ...ui.blockInset, maxHeight: "220px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredThemes.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No themes match this search.</p>
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
                <p style={{ ...ui.blockInset, marginTop: "0.65rem", fontStyle: "italic", fontSize: "0.9rem" }}>{selectedTheme.raw.flavor}</p>
              )}
              {selectedTheme?.raw?.body && typeof selectedTheme.raw.body === "string" && (
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary style={detailsSummaryStyle}>Theme details</summary>
                  <div style={{ marginTop: "0.4rem" }}>
                    <RulesRichText text={String(selectedTheme.raw.body)} paragraphStyle={{ fontSize: "0.9rem" }} listItemStyle={{ fontSize: "0.9rem" }} />
                  </div>
                </details>
              )}
              {themeGrantedPowers.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <h5 style={subsectionTitleStyle}>Powers from this theme</h5>
                  <p style={{ margin: "0 0 0.45rem 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    These are granted when your level reaches each power&apos;s printed level (same list as on the Powers tab).
                  </p>
                  <div>{themeGrantedPowers.map((p) => renderPowerCardWithSelections(p, `paths-theme-${p.id}`))}</div>
                </div>
              )}
            </section>

            <section style={{ marginBottom: "1.25rem" }}>
              <h4 style={subsectionTitleStyle}>Paragon path</h4>
              {build.level < 11 && (
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--status-warning)" }}>Set level to 11 or higher to choose a paragon path.</p>
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
              <div style={{ ...ui.blockInset, maxHeight: "240px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredParagonPaths.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No paragon paths match this search.</p>
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
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary style={detailsSummaryStyle}>Paragon path details</summary>
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
              <h4 style={subsectionTitleStyle}>Epic destiny</h4>
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
              <div style={{ ...ui.blockInset, maxHeight: "240px", overflow: "auto", backgroundColor: "var(--surface-1)", padding: "0.35rem" }}>
                {filteredEpicDestinies.length === 0 ? (
                  <p style={{ margin: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>No epic destinies match this search.</p>
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
                <details open style={{ marginTop: "0.5rem" }}>
                  <summary style={detailsSummaryStyle}>Epic destiny details</summary>
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
            <h3 style={sectionTitleStyle}>Equipment</h3>
            <div style={{ ...ui.blockInset, marginTop: "0.35rem", display: "grid", gap: "0.75rem", backgroundColor: "var(--surface-1)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.65rem" }}>
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
              <label style={{ fontSize: "0.88rem" }}>
                Filter main-hand weapons
                <input
                  type="search"
                  value={mainWeaponSearch}
                  onChange={(e) => setMainWeaponSearch(e.target.value)}
                  placeholder="Name, category…"
                  style={{
                    width: "100%",
                    marginTop: "0.2rem",
                    padding: "0.35rem 0.45rem",
                    borderRadius: "6px",
                    border: "1px solid var(--panel-border)",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <label style={{ fontSize: "0.88rem" }}>
                Main weapon
                <select
                  value={build.mainWeaponId || ""}
                  onChange={(e) => updateBuild({ ...build, mainWeaponId: e.target.value || undefined })}
                  style={{ width: "100%", marginTop: "0.2rem", padding: "0.35rem", borderRadius: "6px", border: "1px solid var(--panel-border)", boxSizing: "border-box" }}
                >
                  <option value="">None</option>
                  {mainWeaponOptions.map((w: Weapon) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.weaponCategory ? ` (${w.weaponCategory})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.88rem" }}>
                Filter off-hand weapon
                <input
                  type="search"
                  value={offHandWeaponSearch}
                  onChange={(e) => setOffHandWeaponSearch(e.target.value)}
                  placeholder="Name, category…"
                  style={{
                    width: "100%",
                    marginTop: "0.2rem",
                    padding: "0.35rem 0.45rem",
                    borderRadius: "6px",
                    border: "1px solid var(--panel-border)",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <label style={{ fontSize: "0.88rem" }}>
                Off-hand weapon / second weapon
                <select
                  value={build.offHandWeaponId || ""}
                  onChange={(e) => updateBuild({ ...build, offHandWeaponId: e.target.value || undefined })}
                  style={{ width: "100%", marginTop: "0.2rem", padding: "0.35rem", borderRadius: "6px", border: "1px solid var(--panel-border)", boxSizing: "border-box" }}
                >
                  <option value="">None</option>
                  {offHandWeaponOptions.map((w: Weapon) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.weaponCategory ? ` (${w.weaponCategory})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: "0.88rem" }}>
                Filter implements
                <input
                  type="search"
                  value={implementSearch}
                  onChange={(e) => setImplementSearch(e.target.value)}
                  placeholder="Name, group…"
                  style={{
                    width: "100%",
                    marginTop: "0.2rem",
                    padding: "0.35rem 0.45rem",
                    borderRadius: "6px",
                    border: "1px solid var(--panel-border)",
                    boxSizing: "border-box"
                  }}
                />
              </label>
              <label style={{ fontSize: "0.88rem" }}>
                Superior implement
                <select
                  value={build.implementId || ""}
                  onChange={(e) => updateBuild({ ...build, implementId: e.target.value || undefined })}
                  style={{ width: "100%", marginTop: "0.2rem", padding: "0.35rem", borderRadius: "6px", border: "1px solid var(--panel-border)", boxSizing: "border-box" }}
                >
                  <option value="">None</option>
                  {implementOptions.map((imp: Implement) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.name}
                      {imp.implementGroup ? ` (${imp.implementGroup})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button onClick={() => exportBuild(build)}>Export Character JSON</button>
            <button
              onClick={() => {
                const requestedName = (build.name || "Unnamed Character").trim() || "Unnamed Character";
                const existing = loadSavedCharacters().find(
                  (entry) => entry.name.trim().toLowerCase() === requestedName.toLowerCase()
                );
                const shouldOverwrite = existing
                  ? window.confirm(`A saved character named "${requestedName}" already exists. Overwrite it?`)
                  : false;
                if (existing && !shouldOverwrite) {
                  return;
                }
                const result = saveBuildToSavedCharacters(build, { overwriteExistingByName: shouldOverwrite });
                refreshSavedCharacters();
                const actionLabel = result.overwritten ? "Overwrote" : "Saved";
                alert(`${actionLabel} "${result.entry.name}" for Character Sheet.`);
              }}
            >
              Save for Character Sheet
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              Load saved
              <select
                value={selectedSavedCharacterId}
                onChange={(e) => setSelectedSavedCharacterId(e.target.value)}
                style={{ minWidth: "18rem" }}
              >
                <option value="">Select character...</option>
                {savedCharacters.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({new Date(entry.updatedAt).toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if (!selectedSavedCharacterId) return;
                const selected = savedCharacters.find((entry) => entry.id === selectedSavedCharacterId);
                if (!selected) {
                  alert("Selected saved character could not be found.");
                  refreshSavedCharacters();
                  setSelectedSavedCharacterId("");
                  return;
                }
                const shouldLoad = window.confirm(
                  `Load "${selected.name}" into the builder? This replaces your current in-progress character.`
                );
                if (!shouldLoad) return;
                updateBuild({ ...selected.build });
                setSelectedSavedCharacterId(selected.id);
                alert(`Loaded "${selected.name}".`);
              }}
              disabled={!selectedSavedCharacterId}
            >
              Load Selected
            </button>
            <button
              onClick={() => {
                if (!selectedSavedCharacterId) return;
                const selected = savedCharacters.find((entry) => entry.id === selectedSavedCharacterId);
                if (!selected) {
                  refreshSavedCharacters();
                  setSelectedSavedCharacterId("");
                  return;
                }
                const shouldDelete = window.confirm(`Delete saved character "${selected.name}"? This cannot be undone.`);
                if (!shouldDelete) return;
                const deleted = deleteSavedCharacterById(selected.id);
                refreshSavedCharacters();
                setSelectedSavedCharacterId("");
                if (deleted) {
                  alert(`Deleted "${selected.name}".`);
                } else {
                  alert("Saved character was not found.");
                }
              }}
              disabled={!selectedSavedCharacterId}
            >
              Delete Selected
            </button>
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
        <div style={{ ...ui.blockInset, marginTop: "0.75rem", backgroundColor: "var(--surface-0)" }}>
          <details>
            <summary style={jsonSummaryStyle}>
              JSON
            </summary>
            <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={jsonSearchInput}
                onChange={(event) => setJsonSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const committed = jsonSearchInput.trim();
                  setJsonSearchQuery(committed);
                  setJsonSearchResultIdx(0);
                  setJsonSearchJumpTick((prev) => prev + 1);
                }}
                placeholder="Search JSON..."
                style={{
                  minWidth: 260,
                  border: "1px solid var(--panel-border)",
                  borderRadius: "0.28rem",
                  padding: "0.22rem 0.3rem"
                }}
              />
              <button
                type="button"
                disabled={jsonSearchMatches.length === 0}
                onClick={() =>
                  setJsonSearchResultIdx((prev) => {
                    const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev - 1 + jsonSearchMatches.length) % jsonSearchMatches.length;
                    setJsonSearchJumpTick((tick) => tick + 1);
                    return nextIdx;
                  })
                }
              >
                Previous
              </button>
              <button
                type="button"
                disabled={jsonSearchMatches.length === 0}
                onClick={() =>
                  setJsonSearchResultIdx((prev) => {
                    const nextIdx = jsonSearchMatches.length === 0 ? 0 : (prev + 1) % jsonSearchMatches.length;
                    setJsonSearchJumpTick((tick) => tick + 1);
                    return nextIdx;
                  })
                }
              >
                Next
              </button>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                {jsonSearchQuery.trim()
                  ? jsonSearchMatches.length > 0
                    ? `${Math.min(jsonSearchResultIdx + 1, jsonSearchMatches.length)} of ${jsonSearchMatches.length}`
                    : "0 matches"
                  : "Type and press Enter"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!navigator.clipboard?.writeText) {
                    alert("Clipboard API unavailable in this browser.");
                    return;
                  }
                  void navigator.clipboard.writeText(expandedBuildJson);
                }}
                style={{ marginLeft: "auto" }}
              >
                Copy Contents
              </button>
            </div>
            <textarea
              ref={jsonTextareaRef}
              value={expandedBuildJson}
              readOnly
              style={{
                margin: "0.5rem 0 0 0",
                padding: "0.5rem",
                borderRadius: "0.3rem",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--surface-1)",
                color: "var(--text-primary)",
                overflow: "auto",
                height: "44rem",
                minHeight: "12rem",
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "0.76rem",
                lineHeight: 1.35
              }}
            />
          </details>
        </div>
      </div>

      <div style={ui.sidebarColumn}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: "0.75rem" }}>Live Character Sheet</h3>
        <div style={{ ...ui.blockInset, backgroundColor: "var(--surface-1)", borderColor: "var(--panel-border)", display: "grid", gap: "0.75rem" }}>
          <div>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Character
            </p>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("race")}
              >
                <strong>Race:</strong> {selectedRace?.name || "None"}
              </p>
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("class")}
              >
                <strong>Class:</strong>{" "}
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
              {build.classSelections?.buildOption && (
                <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Class Build:</strong> {build.classSelections.buildOption}</p>
              )}
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("level")}
              >
                <strong>Level:</strong> {build.level}
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Theme:</strong> {selectedTheme?.name || "None"}</p>
              {themeGrantedPowers.length > 0 && (
                <details style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <summary style={detailsSummaryStyle}>
                    Theme granted powers ({themeGrantedPowers.length}) — summary
                  </summary>
                  <ul style={{ margin: "0.35rem 0 0 0", paddingLeft: "1.1rem" }}>
                    {themeGrantedPowers.map((p) => (
                      <li key={p.id}>
                        {p.name}
                        {p.level != null ? ` (lvl ${p.level})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Paragon Path:</strong> {selectedParagonPath?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Epic Destiny:</strong> {selectedEpicDestiny?.name || "None"}</p>
              {multiclassFeatIdList.length > 0 && (
                <details style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <summary style={detailsSummaryStyle}>
                    Multiclass-related feats ({multiclassFeatIdList.length})
                  </summary>
                  <ul style={{ margin: "0.35rem 0 0 0", paddingLeft: "1.1rem" }}>
                    {multiclassFeatIdList.map((fid) => {
                      const f = index.feats.find((x) => x.id === fid);
                      return <li key={fid}>{f?.name ?? fid}</li>;
                    })}
                  </ul>
                </details>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Combat Stats
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.3rem 0.75rem" }}>
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("hp")}
              >
                <strong>HP:</strong> {derived.maxHp}
              </p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Speed:</strong> {derived.speed}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Initiative:</strong> {derived.initiative >= 0 ? `+${derived.initiative}` : derived.initiative}</p>
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("surges")}
              >
                <strong>Healing Surges:</strong> {derived.healingSurgesPerDay}
              </p>
              <p
                style={{ margin: 0, fontSize: "0.88rem" }}
                {...glossaryHoverA11y("surgeValue")}
              >
                <strong>Surge Value:</strong> {derived.surgeValue}
              </p>
            </div>
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
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Defenses
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.3rem 0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>AC:</strong> {derived.defenses.ac}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Fortitude:</strong> {derived.defenses.fortitude}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Reflex:</strong> {derived.defenses.reflex}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Will:</strong> {derived.defenses.will}</p>
            </div>
            <details style={{ marginTop: "0.45rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              <summary style={detailsSummaryStyle}>AC breakdown</summary>
              <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)" }}>
                AC = 10 + armor + shield + best of DEX/INT when allowed by armor.
              </p>
              <div style={{ marginTop: "0.35rem", display: "grid", gap: "0.15rem", fontVariantNumeric: "tabular-nums" }}>
                <span>Base {derived.acBreakdown.base}</span>
                <span>Armor +{derived.acBreakdown.armorBonus}</span>
                <span>Shield +{derived.acBreakdown.shieldBonus}</span>
                <span>
                  Ability ({derived.acBreakdown.abilityLabel}){" "}
                  {derived.acBreakdown.abilityLabel === "—" ? "—" : `${derived.acBreakdown.abilityBonus >= 0 ? "+" : ""}${derived.acBreakdown.abilityBonus}`}
                </span>
              </div>
            </details>
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.65rem" }}>
            <p style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}>
              Equipment
            </p>
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Armor:</strong> {selectedArmor?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Shield:</strong> {selectedShield?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Main weapon:</strong> {selectedMainWeapon?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Off-hand:</strong> {selectedOffHandWeapon?.name || "None"}</p>
              <p style={{ margin: 0, fontSize: "0.88rem" }}><strong>Implement:</strong> {selectedImplement?.name || "None"}</p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.65rem" }}>
            <p
              style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}
              {...glossaryHoverA11y("abilityScores")}
            >
              Ability Scores
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.3rem 0.75rem", fontVariantNumeric: "tabular-nums" }}>
              {abilities.map((ability) => {
                const score = effectiveAbilityScores[ability];
                const mod = abilityModifier(score);
                return (
                  <p key={ability} style={{ margin: 0, fontSize: "0.88rem" }}>
                    <strong>{ability}:</strong> {score} ({formatAbilityMod(mod)})
                  </p>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.65rem" }}>
            <p
              style={{ margin: "0 0 0.4rem 0", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-secondary)", textTransform: "uppercase" }}
              {...glossaryHoverA11y("skills")}
            >
              Skills
            </p>
            <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Includes untrained skills; trained rows add +5 and ignore armor check penalty.
            </p>
            <div style={{ display: "grid", gap: "0.2rem", fontSize: "0.82rem", maxHeight: "11rem", overflow: "auto" }}>
              {skillSheetRows.map((row) => (
                <div
                  key={row.skillId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {row.name}
                    {row.trained ? " (T)" : ""}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {row.modifier >= 0 ? "+" : ""}
                    {row.modifier}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {showGlossaryHoverInfo && glossaryHoverKey && glossaryHoverPanelPos && (
            <div
              id={BUILDER_GLOSSARY_TOOLTIP_ID}
              role="tooltip"
              onMouseEnter={cancelGlossaryHoverCloseTimer}
              onMouseLeave={leaveGlossaryHover}
              style={{
                position: "fixed",
                top: glossaryHoverPanelPos.top,
                left: glossaryHoverPanelPos.left,
                transform: glossaryHoverPanelPos.transform ?? "none",
                width: "360px",
                maxHeight: "48vh",
                overflow: "auto",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--surface-0)",
                borderRadius: "0.35rem",
                padding: "0.45rem 0.5rem",
                color: "var(--text-primary)",
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
                fontSize: "0.78rem",
                lineHeight: 1.35,
                zIndex: 1000,
                boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)"
              }}
            >
              {glossaryContent(glossaryHoverKey)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

