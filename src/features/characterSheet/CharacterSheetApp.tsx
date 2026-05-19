import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import type { Armor, Implement, RacialTrait, RulesIndex, Weapon } from "../../rules/models";
import { resolveRacialTraitsForRace } from "../../rules/racialTraits";
import {
  getClassTraitRows,
  getEpicDestinyTraitRows,
  getHybridClassTraitRows,
  getFeatGrantedTraitRows,
  getParagonTraitRows,
  getThemeTraitRows,
  type TraitDisplayRow
} from "../../rules/supportTraits";
import {
  collectFeatProficiencyDisplayRows,
  collectFeatProficiencyGrants
} from "../../rules/featProficiencies";
import { collectFeatGrantedPowersForBuild } from "../../rules/grantedPowersQuery";
import { computeSkillSheetRows } from "../../rules/skillCalculator";
import {
  ABILITY_SCORE_COLUMNS,
  buildAcScoreComponents,
  DEFENSE_SCORE_COLUMNS,
  defenseRowValues,
  MOTION_SCORE_COLUMNS,
  motionUnifiedRowValues
} from "../../rules/statScoreBreakdown";
import { CollapsibleDisclosure } from "../../ui/CollapsibleDisclosure";
import { SKILL_BREAKDOWN_COLUMNS } from "../../ui/scoreBreakdownColumns";
import {
  formatSkillBreakdownComponent,
  formatSkillBreakdownTotal,
  skillRowMap,
  skillRowsToBreakdown
} from "../../ui/scoreBreakdownSkill";
import { SkillModifierNameContent } from "../../ui/scoreBreakdownSkillName";
import { ScoreBreakdownTable, type ScoreBreakdownRowDef } from "../../ui/ScoreBreakdownTable";
import { loadBuild, loadSavedCharacters, type SavedCharacterEntry } from "../builder/storage";
import { GlossaryTooltipRichText, RulesRichText } from "../builder/RulesRichText";
import { CharacterPowerCard, powerCardUsageAccentBarColor } from "../../ui/powerCard";
import { areActiveConditionsDuplicate, createActiveCondition } from "./activeConditions";
import {
  buildDurationFromPreset,
  conditionDurationDisplayPhrase,
  CONDITION_DURATION_PRESET_OPTIONS,
  type ConditionDurationPresetKey
} from "./conditionDurationPresets";
import { createDefaultCharacterSheetState } from "./defaultState";
import type { CharacterSheetState, EquippedSlotKey, EquipmentSlot, PowerSheetGroupBy } from "./model";
import { buildPowerDisplaySections, powerUsageBucket } from "./powerDisplay";
import {
  canUseSecondWind,
  hasSecondWindDefenseBonus,
  refreshSecondWindOnRest,
  SECOND_WIND_DEFENSE_BONUS,
  spendHealingSurgeResources,
  useSecondWindResources
} from "./healingSurgeActions";
import { computeMagicItemCombatBonuses } from "../../rules/magicItemEquipment";
import {
  computeSheetDerivedData,
  findImplementEquippedFromSheet,
  findWeaponEquippedInSlot,
  groupCombatPowers,
  sheetClassForImplementAttack,
  sheetImplementProficiencyText,
  sheetStateFromBuild,
  sheetWeaponProficiencyText,
  toBuildLikeState
} from "./selectors";
import { EquipmentTab, type EquipmentEditorSlot } from "../builder/EquipmentTab";
import type { EquipmentPriceSlot } from "../../rules/equipmentItemPrice";
import { CharacterEquippedSlotsPanel } from "./CharacterEquippedSlotsPanel";
import { CharacterInventoryList } from "./CharacterInventoryList";
import { equipmentSlotGoldCost } from "../../rules/equipmentItemPrice";
import {
  addAcquiredEquipmentToSheet,
  buildLikeStateFromSheet,
  characterSheetInventoryItems,
  equipInventoryItemOnSheet,
  unequipInventoryItemOnSheet,
  sheetCharacterEquipment,
  updateSheetEquipmentFromBuild
} from "./sheetEquipment";
import { loadCharacterSheetState, saveCharacterSheetState } from "./storage";
import { resolveUiGlossaryHoverPlainText, termHasPowerKeywordTooltipBody } from "../../data/glossaryHoverResolve";
import { positionFixedTooltip } from "../../ui/glossaryTooltipPosition";
import { GLOSSARY_TOOLTIP_OPEN_DELAY_MS, STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE } from "../../ui/glossaryTooltip";
import { useGlossaryTooltip } from "../../ui/useGlossaryTooltip";
import { AdjustableNumberInput } from "../../ui/AdjustableNumberInput";
import { JsonCollapsiblePanel } from "../../ui/JsonCollapsiblePanel";
import { summarizeImplementAttack, summarizeMainWeaponAttack } from "../../rules/weaponAttack";

type SheetTab = "overview" | "equipment";

const tabLabel: Record<SheetTab, string> = {
  overview: "Character",
  equipment: "Equipment"
};

const panelStyle: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  padding: "0.55rem",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
};

/** Overview center column (traits + feats; row 2: HP/resources); wide enough for the rest strip without its own scrollbar. */
const OVERVIEW_CENTER_COLUMN_MIN_WIDTH = "26rem";
const overviewSideColumnStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  alignContent: "start",
  minWidth: 0,
  maxWidth: "100%",
  overflow: "hidden"
};

const overviewCenterColumnStyle: CSSProperties = {
  display: "grid",
  gap: "0.5rem",
  alignContent: "start",
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden"
};

const overviewThreeColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `minmax(0, 1fr) minmax(${OVERVIEW_CENTER_COLUMN_MIN_WIDTH}, 1fr) minmax(0, 1fr)`,
  gap: "0.5rem",
  alignItems: "stretch",
  minWidth: 0,
  width: "100%"
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const overviewCollapsiblePanelStyle: CSSProperties = {
  padding: "0.15rem 0",
  minWidth: 0
};

const overviewCollapsibleSummaryStyle: CSSProperties = {
  ...sectionTitleStyle,
  cursor: "pointer",
  color: "var(--text-primary)"
};

type CharacterIdentityFieldProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  onLabelMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
  onLabelMouseLeave?: () => void;
  onLabelFocus?: (event: ReactFocusEvent<HTMLElement>) => void;
  onLabelBlur?: () => void;
  labelTabIndex?: number;
};

function CharacterIdentityField({
  label,
  children,
  className,
  onLabelMouseEnter,
  onLabelMouseLeave,
  onLabelFocus,
  onLabelBlur,
  labelTabIndex
}: CharacterIdentityFieldProps): JSX.Element {
  const hasLabelAffordance = Boolean(onLabelMouseEnter || onLabelFocus);
  const fieldClass = className ? `character-sheet-identity__field ${className}` : "character-sheet-identity__field";
  return (
    <div className={fieldClass}>
      <dt>
        {hasLabelAffordance ? (
          <span
            className="character-sheet-identity__label-affordance"
            tabIndex={labelTabIndex ?? 0}
            onMouseEnter={onLabelMouseEnter}
            onMouseLeave={onLabelMouseLeave}
            onFocus={onLabelFocus}
            onBlur={onLabelBlur}
          >
            {label}
          </span>
        ) : (
          label
        )}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

type CharacterIdentitySectionProps = {
  name: string;
  raceName: string;
  classDisplay: string;
  level: number;
  themeName?: string;
  paragonPathName?: string;
  epicDestinyName?: string;
  onRaceLabelMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
  onRaceLabelMouseLeave?: () => void;
  onClassLabelMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
  onClassLabelMouseLeave?: () => void;
  onLevelLabelMouseEnter?: (event: React.MouseEvent<HTMLElement>) => void;
  onLevelLabelMouseLeave?: () => void;
  onLevelLabelFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onLevelLabelBlur?: () => void;
};

function CharacterIdentitySection({
  name,
  raceName,
  classDisplay,
  level,
  themeName,
  paragonPathName,
  epicDestinyName,
  onRaceLabelMouseEnter,
  onRaceLabelMouseLeave,
  onClassLabelMouseEnter,
  onClassLabelMouseLeave,
  onLevelLabelMouseEnter,
  onLevelLabelMouseLeave,
  onLevelLabelFocus,
  onLevelLabelBlur
}: CharacterIdentitySectionProps): JSX.Element {
  const showAdvancement = Boolean(themeName || paragonPathName || epicDestinyName);

  return (
    <section className="character-sheet-identity">
      <dl className="character-sheet-identity__list">
        <CharacterIdentityField label="Name">
          {name || "—"}
        </CharacterIdentityField>
        <div className="character-sheet-identity__row character-sheet-identity__row--core">
          <CharacterIdentityField
            label="Race"
            onLabelMouseEnter={onRaceLabelMouseEnter}
            onLabelMouseLeave={onRaceLabelMouseLeave}
          >
            {raceName || "—"}
          </CharacterIdentityField>
          <CharacterIdentityField
            label="Class"
            onLabelMouseEnter={onClassLabelMouseEnter}
            onLabelMouseLeave={onClassLabelMouseLeave}
          >
            {classDisplay || "—"}
          </CharacterIdentityField>
          <CharacterIdentityField
            label="Level"
            className="character-sheet-identity__field--level"
            onLabelMouseEnter={onLevelLabelMouseEnter}
            onLabelMouseLeave={onLevelLabelMouseLeave}
            onLabelFocus={onLevelLabelFocus}
            onLabelBlur={onLevelLabelBlur}
          >
            {level}
          </CharacterIdentityField>
        </div>
        {showAdvancement && (
          <div className="character-sheet-identity__advancement">
            {themeName && <CharacterIdentityField label="Theme">{themeName}</CharacterIdentityField>}
            {paragonPathName && <CharacterIdentityField label="Paragon path">{paragonPathName}</CharacterIdentityField>}
            {epicDestinyName && <CharacterIdentityField label="Epic destiny">{epicDestinyName}</CharacterIdentityField>}
          </div>
        )}
      </dl>
    </section>
  );
}

type OverviewCollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  shellStyle?: CSSProperties;
  titleTabIndex?: number;
  onTitleMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
  onTitleMouseLeave?: () => void;
  onTitleFocus?: (event: ReactFocusEvent<HTMLElement>) => void;
  onTitleBlur?: () => void;
  children: ReactNode;
};

function traitsSectionTitle(selectionName: string | undefined, fallback: string): string {
  const name = selectionName?.trim();
  return name ? `${name} traits` : fallback;
}

function traitsEmptyMessage(selectionName: string | undefined, fallback: string): string {
  const name = selectionName?.trim();
  return name ? `No ${name} traits listed.` : fallback;
}

function TraitRowsList({ rows, emptyMessage }: { rows: TraitDisplayRow[]; emptyMessage: string }): JSX.Element {
  if (rows.length === 0) {
    return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{emptyMessage}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.18rem" }}>
      {rows.map((trait, idx) => (
          <div
            key={trait.id}
            style={{
              fontSize: "0.8rem",
              lineHeight: 1.2,
              padding: "0.24rem 0.35rem",
              borderRadius: "0.25rem",
              backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)",
              color: "var(--text-primary)"
            }}
          >
            <div style={{ fontWeight: 700 }}>{trait.name}</div>
            {typeof trait.shortDescription === "string" && trait.shortDescription.trim() && (
              <div
                style={{
                  marginTop: "0.14rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.76rem",
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 500
                }}
              >
                {trait.shortDescription}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

function OverviewCollapsibleSection({
  title,
  defaultOpen = true,
  shellStyle,
  titleTabIndex,
  onTitleMouseEnter,
  onTitleMouseLeave,
  onTitleFocus,
  onTitleBlur,
  children
}: OverviewCollapsibleSectionProps): JSX.Element {
  return (
    <CollapsibleDisclosure
      className="template-json-collapsible character-sheet-overview-collapsible"
      open={defaultOpen}
      style={{ ...overviewCollapsiblePanelStyle, ...shellStyle }}
      summaryStyle={overviewCollapsibleSummaryStyle}
      summary={title}
      summaryTabIndex={titleTabIndex}
      onSummaryMouseEnter={onTitleMouseEnter}
      onSummaryMouseLeave={onTitleMouseLeave}
      onSummaryFocus={onTitleFocus}
      onSummaryBlur={onTitleBlur}
    >
      {children}
    </CollapsibleDisclosure>
  );
}

const detailsSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "0.82rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-secondary)"
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: "0.2rem",
  fontSize: "0.78rem",
  color: "var(--text-primary)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

/** HP panel resource labels (Hit Points, Temp HP, Healing Surges, etc.). */
const hpPanelResourceFieldBoxStyle: CSSProperties = {
  ...labelStyle,
  alignSelf: "stretch",
  padding: "0.28rem 0.35rem",
  border: "1px solid var(--panel-border)",
  borderRadius: "0.3rem",
  backgroundColor: "var(--surface-1)",
  minWidth: 0
};

/** Lets grid columns shrink below min-content width (Temp HP, Action Pts, Death Saves, Healing Surges). */
const hpPanelShrinkableBoxStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: "100%",
  width: "100%",
  boxSizing: "border-box"
};

const hpPanelResourceSuffixStyle: CSSProperties = {
  fontSize: labelStyle.fontSize,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "none",
  letterSpacing: "normal"
};

const hpPanelResourceHintStyle: CSSProperties = {
  ...hpPanelResourceSuffixStyle,
  fontWeight: 600,
  color: "var(--text-muted)",
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.15,
  textAlign: "center"
};

const hpPanelHealButtonStyle: CSSProperties = {
  fontSize: labelStyle.fontSize,
  padding: "0.14rem 0.35rem",
  borderRadius: "0.22rem",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontWeight: labelStyle.fontWeight,
  textTransform: "none",
  letterSpacing: "normal",
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box"
};

const healingSurgesLabelStackStyle: CSSProperties = {
  display: "block",
  position: "relative",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0
};

const healingSurgesLabelVisibleStyle: CSSProperties = {
  display: "block",
  width: "100%",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  fontSize: labelStyle.fontSize,
  fontWeight: labelStyle.fontWeight,
  letterSpacing: labelStyle.letterSpacing,
  textTransform: labelStyle.textTransform,
  color: labelStyle.color
};

const healingSurgesLabelProbeStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  visibility: "hidden",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  width: "max-content",
  maxWidth: "none",
  fontSize: labelStyle.fontSize,
  fontWeight: labelStyle.fontWeight,
  letterSpacing: labelStyle.letterSpacing,
  textTransform: labelStyle.textTransform
};

const healingSurgeValueHintProbeStyle: CSSProperties = {
  ...healingSurgesLabelProbeStyle,
  fontWeight: 600,
  textTransform: "none",
  letterSpacing: "normal",
  fontVariantNumeric: "tabular-nums"
};

function HealingSurgeValueHint({
  surgeValue,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur
}: {
  surgeValue: number;
  onMouseEnter: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: ReactFocusEvent<HTMLSpanElement>) => void;
  onBlur: () => void;
}): JSX.Element {
  const stackRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [useStacked, setUseStacked] = useState(false);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    const probe = probeRef.current;
    if (!stack || !probe) return;

    const measure = (): void => {
      const availableWidth = stack.getBoundingClientRect().width;
      if (availableWidth <= 0) return;
      const textWidth = probe.getBoundingClientRect().width;
      setUseStacked(textWidth >= availableWidth - 0.5);
    };

    measure();
    const rafId = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    const flexRow = stack.parentElement;
    if (flexRow) observer.observe(flexRow);
    const surgesBox = flexRow?.parentElement?.parentElement;
    if (surgesBox) observer.observe(surgesBox);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [surgeValue]);

  return (
    <span
      ref={stackRef}
      style={{
        ...hpPanelResourceHintStyle,
        ...healingSurgesLabelStackStyle,
        flex: "1 1 0",
        minWidth: 0
      }}
    >
      <span ref={probeRef} aria-hidden style={healingSurgeValueHintProbeStyle}>
        +{surgeValue} HP / surge
      </span>
      <span
        tabIndex={0}
        style={{
          display: useStacked ? "inline-flex" : "inline",
          flexDirection: useStacked ? "column" : undefined,
          alignItems: useStacked ? "center" : undefined,
          width: "100%",
          minWidth: 0,
          lineHeight: 1.15,
          whiteSpace: "nowrap"
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {useStacked ? (
          <>
            <span>+{surgeValue} HP /</span>
            <span>surge</span>
          </>
        ) : (
          <>+{surgeValue} HP / surge</>
        )}
      </span>
    </span>
  );
}

function HealingSurgesFieldLabel({
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur
}: {
  onMouseEnter: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  onMouseLeave: () => void;
  onFocus: (event: ReactFocusEvent<HTMLSpanElement>) => void;
  onBlur: () => void;
}): JSX.Element {
  const stackRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [useShortLabel, setUseShortLabel] = useState(false);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    const probe = probeRef.current;
    if (!stack || !probe) return;

    const measure = (): void => {
      const availableWidth = stack.getBoundingClientRect().width;
      if (availableWidth <= 0) return;
      const textWidth = probe.getBoundingClientRect().width;
      setUseShortLabel(textWidth >= availableWidth - 0.5);
    };

    measure();
    const rafId = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    const hostLabel = stack.closest("label");
    if (hostLabel) observer.observe(hostLabel);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <span ref={stackRef} style={healingSurgesLabelStackStyle}>
      <span ref={probeRef} aria-hidden style={healingSurgesLabelProbeStyle}>
        Healing Surges
      </span>
      <span
        tabIndex={0}
        style={healingSurgesLabelVisibleStyle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {useShortLabel ? "Surges" : "Healing Surges"}
      </span>
    </span>
  );
}


function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const GLOSSARY_CONDITION_OPTIONS = [
  "Blinded",
  "Dazed",
  "Deafened",
  "Dominated",
  "Helpless",
  "Immobilized",
  "Marked",
  "Petrified",
  "Prone",
  "Restrained",
  "Slowed",
  "Stunned",
  "Surprised",
  "Unconscious",
  "Weakened"
] as const;


const CONDITION_COLORS: Record<string, { background: string; text: string }> = {
  bloodied: { background: "var(--condition-bloodied-bg)", text: "var(--condition-bloodied-fg)" },
  dying: { background: "var(--condition-dying-bg)", text: "var(--condition-dying-fg)" },
  dead: { background: "var(--condition-dead-bg)", text: "var(--condition-dead-fg)" },
  blinded: { background: "var(--condition-blinded-bg)", text: "var(--condition-blinded-fg)" },
  dazed: { background: "var(--condition-dazed-bg)", text: "var(--condition-dazed-fg)" },
  deafened: { background: "var(--condition-deafened-bg)", text: "var(--condition-deafened-fg)" },
  dominated: { background: "var(--condition-dominated-bg)", text: "var(--condition-dominated-fg)" },
  helpless: { background: "var(--condition-helpless-bg)", text: "var(--condition-helpless-fg)" },
  immobilized: { background: "var(--condition-immobilized-bg)", text: "var(--condition-immobilized-fg)" },
  marked: { background: "var(--condition-marked-bg)", text: "var(--condition-marked-fg)" },
  petrified: { background: "var(--condition-petrified-bg)", text: "var(--condition-petrified-fg)" },
  prone: { background: "var(--condition-prone-bg)", text: "var(--condition-prone-fg)" },
  restrained: { background: "var(--condition-restrained-bg)", text: "var(--condition-restrained-fg)" },
  slowed: { background: "var(--condition-slowed-bg)", text: "var(--condition-slowed-fg)" },
  stunned: { background: "var(--condition-stunned-bg)", text: "var(--condition-stunned-fg)" },
  surprised: { background: "var(--condition-surprised-bg)", text: "var(--condition-surprised-fg)" },
  unconscious: { background: "var(--condition-unconscious-bg)", text: "var(--condition-unconscious-fg)" },
  weakened: { background: "var(--condition-weakened-bg)", text: "var(--condition-weakened-fg)" }
};

const CONDITION_EMOJIS: Record<string, string> = {
  bloodied: "\u{1FA78}",
  dying: "\u26A0\uFE0F",
  dead: "\u2620\uFE0F",
  blinded: "\u{1F648}",
  dazed: "\u{1F4AB}",
  deafened: "\u{1F515}",
  dominated: "\u{1F9E0}",
  helpless: "\u{1FAF3}",
  immobilized: "\u{1F9F1}",
  marked: "\u{1F3AF}",
  petrified: "\u{1FAA8}",
  prone: "\u2B07\uFE0F",
  restrained: "\u26D3\uFE0F",
  slowed: "\u{1F422}",
  stunned: "\u{1F635}",
  surprised: "\u2757",
  unconscious: "\u{1F4A4}",
  weakened: "\u{1FAAB}"
};

function conditionBadgeStyle(name: string): CSSProperties {
  const colors = CONDITION_COLORS[name.trim().toLowerCase()] ?? { background: "var(--surface-3)", text: "var(--text-primary)" };
  return {
    padding: "0.14rem 0.35rem",
    borderRadius: "0.25rem",
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: "0.74rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    width: "fit-content"
  };
}

function conditionDisplayLabel(name: string): string {
  const normalized = name.trim().toLowerCase();
  const emoji = CONDITION_EMOJIS[normalized] ?? "\u{1F3F7}\uFE0F";
  return `${emoji} ${name}`;
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

function DeathSaveCheckboxes(props: { value: number; onChange: (next: number) => void }): JSX.Element {
  const value = clamp(props.value, 0, 3);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem",
        rowGap: "0.25rem",
        alignItems: "center",
        marginTop: "0.1rem",
        minWidth: 0
      }}
    >
      {[0, 1, 2].map((idx) => (
        <label
          key={idx}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.2rem",
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            flexShrink: 1,
            minWidth: 0
          }}
        >
          <input
            type="checkbox"
            checked={idx < value}
            onChange={(e) => {
              if (e.target.checked) props.onChange(Math.max(value, idx + 1));
              else props.onChange(idx);
            }}
          />
          {idx + 1}
        </label>
      ))}
    </div>
  );
}

type AbilityCode = "STR" | "CON" | "DEX" | "INT" | "WIS" | "CHA";
type GlossaryKey =
  | "level"
  | "hp"
  | "tempHp"
  | "actionPoints"
  | "surges"
  | "surgeValue"
  | "bloodied"
  | "dying"
  | "dead"
  | "speed"
  | "initiative"
  | "defenses"
  | "ac"
  | "fortitude"
  | "reflex"
  | "will"
  | "deathSaves"
  | "skills"
  | "abilityScores"
  | `condition:${string}`
  | `powerKeyword:${string}`
  | `powerUsage:atWill`
  | `powerUsage:encounter`
  | `powerUsage:daily`
  | `ability:${AbilityCode}`
  | `skill:${string}`
  | "shortRest"
  | "extendedRest"
  | "secondWind";
const CHARACTER_SHEET_GLOSSARY_TOOLTIP_ID = "character-sheet-glossary-tooltip";

export function CharacterSheetApp({ index, tooltipGlossary }: { index: RulesIndex; tooltipGlossary: Record<string, string> }): JSX.Element {
  const [sheet, setSheet] = useState<CharacterSheetState>(() => loadCharacterSheetState());
  const [tab, setTab] = useState<SheetTab>("overview");
  const [draggingPowerId, setDraggingPowerId] = useState<string | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterEntry[]>(() => loadSavedCharacters());
  const [selectedSavedCharacterId, setSelectedSavedCharacterId] = useState("");
  const [selectedConditionOption, setSelectedConditionOption] = useState("");
  const [customConditionText, setCustomConditionText] = useState("");
  const [selectedDurationPreset, setSelectedDurationPreset] = useState<ConditionDurationPresetKey>("");
  const [conditionDurationRounds, setConditionDurationRounds] = useState(1);
  const [showRaceHoverInfo, setShowRaceHoverInfo] = useState(false);
  const [raceHoverPanelPos, setRaceHoverPanelPos] = useState<{
    top: number;
    left: number;
    transform?: "translateY(-100%)";
  } | null>(null);
  const [showClassHoverInfo, setShowClassHoverInfo] = useState(false);
  const [classHoverPanelPos, setClassHoverPanelPos] = useState<{
    top: number;
    left: number;
    transform?: "translateY(-100%)";
  } | null>(null);
  const glossaryTooltipUi = useGlossaryTooltip({ tooltipId: CHARACTER_SHEET_GLOSSARY_TOOLTIP_ID });
  const raceHoverTimerRef = useRef<number | null>(null);
  const classHoverTimerRef = useRef<number | null>(null);
  const glossaryTermLookupCacheRef = useRef<Map<string, boolean>>(new Map());

  const derived = useMemo(() => computeSheetDerivedData(sheet, index), [sheet, index]);
  const groupedPowers = useMemo(() => groupCombatPowers(sheet, index), [sheet, index]);
  const powerGroupBy = sheet.powers.groupBy ?? "usage";
  const powerDisplaySections = useMemo(
    () => buildPowerDisplaySections(groupedPowers, powerGroupBy),
    [groupedPowers, powerGroupBy]
  );
  const rulesById = useMemo(() => buildRulesIdLookup(index), [index]);
  const expandedSheetJson = useMemo(() => JSON.stringify(expandJsonIds(sheet, rulesById), null, 2), [sheet, rulesById]);
  const skillById = useMemo(() => new Map(index.skills.map((skill) => [skill.id, skill])), [index.skills]);
  const featsById = useMemo(() => new Map(index.feats.map((feat) => [feat.id, feat])), [index.feats]);
  const racialTraitsById = useMemo(
    () => new Map<string, RacialTrait>((index.racialTraits ?? []).map((trait) => [trait.id, trait])),
    [index.racialTraits]
  );
  const racialTraitRows = useMemo(
    () => resolveRacialTraitsForRace(derived.race, racialTraitsById).filter((row): row is { id: string; trait: RacialTrait } => Boolean(row.trait)),
    [derived.race, racialTraitsById]
  );
  const selectedFeatRows = useMemo(
    () => (sheet.featIds ?? []).map((featId) => featsById.get(featId)).filter((feat): feat is NonNullable<typeof feat> => Boolean(feat)),
    [sheet.featIds, featsById]
  );
  const selectedTheme = useMemo(
    () => (sheet.themeId ? index.themes.find((t) => t.id === sheet.themeId) : undefined),
    [index.themes, sheet.themeId]
  );
  const selectedParagonPath = useMemo(
    () => (sheet.paragonPathId ? index.paragonPaths.find((p) => p.id === sheet.paragonPathId) : undefined),
    [index.paragonPaths, sheet.paragonPathId]
  );
  const selectedEpicDestiny = useMemo(
    () => (sheet.epicDestinyId ? index.epicDestinies.find((d) => d.id === sheet.epicDestinyId) : undefined),
    [index.epicDestinies, sheet.epicDestinyId]
  );
  const hybridClassA = useMemo(
    () =>
      sheet.characterStyle === "hybrid" && sheet.hybridClassIdA
        ? index.hybridClasses?.find((h) => h.id === sheet.hybridClassIdA)
        : undefined,
    [index.hybridClasses, sheet.characterStyle, sheet.hybridClassIdA]
  );
  const hybridClassB = useMemo(
    () =>
      sheet.characterStyle === "hybrid" && sheet.hybridClassIdB
        ? index.hybridClasses?.find((h) => h.id === sheet.hybridClassIdB)
        : undefined,
    [index.hybridClasses, sheet.characterStyle, sheet.hybridClassIdB]
  );
  const classTraitRows = useMemo(() => {
    if (sheet.characterStyle === "hybrid" && sheet.hybridClassIdA && sheet.hybridClassIdB) {
      return getHybridClassTraitRows(hybridClassA, hybridClassB, index);
    }
    return getClassTraitRows(derived.cls, index);
  }, [sheet.characterStyle, sheet.hybridClassIdA, sheet.hybridClassIdB, hybridClassA, hybridClassB, derived.cls, index]);
  const themeTraitRows = useMemo(
    () => getThemeTraitRows(selectedTheme, index, sheet.level),
    [selectedTheme, index, sheet.level]
  );
  const paragonTraitRows = useMemo(
    () => getParagonTraitRows(selectedParagonPath, index, sheet.level),
    [selectedParagonPath, index, sheet.level]
  );
  const epicDestinyTraitRows = useMemo(
    () => getEpicDestinyTraitRows(selectedEpicDestiny, index, sheet.level),
    [selectedEpicDestiny, index, sheet.level]
  );
  const showClassTraits = sheet.characterStyle === "hybrid" ? Boolean(sheet.hybridClassIdA && sheet.hybridClassIdB) : Boolean(sheet.classId);
  const showThemeTraits = Boolean(sheet.themeId);
  const showParagonTraits = Boolean(sheet.paragonPathId && sheet.level >= 11);
  const showEpicDestinyTraits = Boolean(sheet.epicDestinyId && sheet.level >= 21);
  const racialTraitsSectionTitle = useMemo(
    () => traitsSectionTitle(derived.race?.name, "Racial traits"),
    [derived.race?.name]
  );
  const classTraitsSectionTitle = useMemo(() => {
    if (sheet.characterStyle === "hybrid" && hybridClassA && hybridClassB) {
      return traitsSectionTitle(`${hybridClassA.name} / ${hybridClassB.name}`, "Class traits");
    }
    return traitsSectionTitle(derived.cls?.name, "Class traits");
  }, [sheet.characterStyle, hybridClassA, hybridClassB, derived.cls?.name]);
  const themeTraitsSectionTitle = useMemo(
    () => traitsSectionTitle(selectedTheme?.name, "Theme traits"),
    [selectedTheme?.name]
  );
  const paragonTraitsSectionTitle = useMemo(
    () => traitsSectionTitle(selectedParagonPath?.name, "Paragon traits"),
    [selectedParagonPath?.name]
  );
  const epicDestinyTraitsSectionTitle = useMemo(
    () => traitsSectionTitle(selectedEpicDestiny?.name, "Epic destiny traits"),
    [selectedEpicDestiny?.name]
  );
  const featGrantedTraitRows = useMemo(
    () => getFeatGrantedTraitRows(index, sheet.featIds ?? []),
    [index, sheet.featIds]
  );
  const featGrantedPowerRows = useMemo(
    () => collectFeatGrantedPowersForBuild(index, { featIds: sheet.featIds ?? [] }),
    [index, sheet.featIds]
  );
  const featProficiencyGrants = useMemo(
    () => collectFeatProficiencyGrants(index, sheet.featIds ?? []),
    [index, sheet.featIds]
  );
  const featProficiencyDisplayRows = useMemo(
    () => collectFeatProficiencyDisplayRows(index, sheet.featIds ?? []),
    [index, sheet.featIds]
  );

  useEffect(() => {
    const build = loadBuild();
    if (!build) return;
    setSheet((prev) => {
      if (
        prev.themeId === build.themeId &&
        prev.paragonPathId === build.paragonPathId &&
        prev.epicDestinyId === build.epicDestinyId &&
        prev.level === build.level
      ) {
        return prev;
      }
      return {
        ...prev,
        level: build.level,
        themeId: build.themeId,
        paragonPathId: build.paragonPathId,
        epicDestinyId: build.epicDestinyId
      };
    });
  }, []);

  const skillRows = useMemo(
    () =>
      computeSkillSheetRows(
        index,
        sheet.level,
        sheet.abilityScores,
        new Set(sheet.trainedSkillIds),
        derived.armorCheckPenalty,
        derived.supportPassiveOther.skillFlatBySkillId
      ),
    [index, sheet.level, sheet.abilityScores, sheet.trainedSkillIds, derived.armorCheckPenalty, derived.supportPassiveOther]
  );

  const mainHandWeapon = useMemo(() => findWeaponEquippedInSlot(sheet, index, "mainHand"), [sheet.equipment, sheet.inventory, index]);
  const offHandWeapon = useMemo(() => findWeaponEquippedInSlot(sheet, index, "offHand"), [sheet.equipment, sheet.inventory, index]);
  const equippedImplement = useMemo(() => findImplementEquippedFromSheet(sheet, index), [sheet.equipment, sheet.inventory, index]);
  const sheetWeaponProfText = useMemo(
    () => sheetWeaponProficiencyText(index, sheet, derived.cls),
    [index, sheet, derived.cls]
  );
  const sheetImplementProfText = useMemo(
    () => sheetImplementProficiencyText(index, sheet, derived.cls),
    [index, sheet, derived.cls]
  );
  const sheetImplementClass = useMemo(
    () => sheetClassForImplementAttack(index, sheet, derived.cls),
    [index, sheet, derived.cls]
  );
  const magicCombat = useMemo(() => {
    return computeMagicItemCombatBonuses(index, toBuildLikeState(sheet, index));
  }, [index, sheet]);
  const sheetEquipmentBuild = useMemo(() => buildLikeStateFromSheet(sheet, index), [sheet, index]);
  const inventoryItems = useMemo(() => characterSheetInventoryItems(sheet, index), [sheet, index]);
  const mainWeaponSummary = useMemo(
    () =>
      summarizeMainWeaponAttack(
        sheet.level,
        sheet.abilityScores,
        mainHandWeapon,
        sheetWeaponProfText,
        magicCombat.mainWeaponAttack,
        featProficiencyGrants,
        "mainHand",
        sheet.equipment
      ),
    [
      sheet.level,
      sheet.abilityScores,
      mainHandWeapon,
      sheetWeaponProfText,
      magicCombat.mainWeaponAttack,
      featProficiencyGrants,
      sheet.equipment
    ]
  );
  const offHandWeaponSummary = useMemo(
    () =>
      summarizeMainWeaponAttack(
        sheet.level,
        sheet.abilityScores,
        offHandWeapon,
        sheetWeaponProfText,
        magicCombat.offHandWeaponAttack,
        featProficiencyGrants,
        "offHand",
        sheet.equipment
      ),
    [
      sheet.level,
      sheet.abilityScores,
      offHandWeapon,
      sheetWeaponProfText,
      magicCombat.offHandWeaponAttack,
      featProficiencyGrants,
      sheet.equipment
    ]
  );
  const implementAttackSummary = useMemo(
    () =>
      summarizeImplementAttack(
        sheet.level,
        sheet.abilityScores,
        sheetImplementClass,
        equippedImplement,
        sheetImplementProfText,
        magicCombat.implementAttack,
        featProficiencyGrants
      ),
    [
      sheet.level,
      sheet.abilityScores,
      sheetImplementClass,
      equippedImplement,
      sheetImplementProfText,
      magicCombat.implementAttack,
      featProficiencyGrants
    ]
  );

  useEffect(() => {
    const nextHp = Math.min(sheet.resources.currentHp, derived.maxHp);
    const nextSurges = clamp(sheet.resources.surgesRemaining, 0, derived.healingSurgesPerDay);
    if (nextHp !== sheet.resources.currentHp || nextSurges !== sheet.resources.surgesRemaining) {
      setSheet((prev) => ({
        ...prev,
        resources: {
          ...prev.resources,
          currentHp: Math.min(prev.resources.currentHp, derived.maxHp),
          surgesRemaining: clamp(prev.resources.surgesRemaining, 0, derived.healingSurgesPerDay)
        }
      }));
    }
  }, [derived.healingSurgesPerDay, derived.maxHp, sheet.resources.currentHp, sheet.resources.surgesRemaining]);

  useEffect(() => {
    saveCharacterSheetState(sheet);
  }, [sheet]);

  useEffect(() => {
    return () => {
      if (raceHoverTimerRef.current != null) {
        window.clearTimeout(raceHoverTimerRef.current);
      }
      if (classHoverTimerRef.current != null) {
        window.clearTimeout(classHoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    glossaryTermLookupCacheRef.current.clear();
  }, [tooltipGlossary, index]);

  useEffect(() => {
    setShowRaceHoverInfo(false);
  }, [sheet.raceId]);

  useEffect(() => {
    setShowClassHoverInfo(false);
  }, [sheet.classId]);

  function glossaryContent(key: GlossaryKey): JSX.Element {
    const resolved = resolveUiGlossaryHoverPlainText(
      key,
      {
        glossaryByName: tooltipGlossary,
        index
      },
      "sheet"
    );
    if (resolved) return <GlossaryTooltipRichText text={resolved} />;
    return <div>No description available.</div>;
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

  function updateSheet(mutator: (prev: CharacterSheetState) => CharacterSheetState): void {
    setSheet((prev) => mutator(prev));
  }

  function setGold(next: number): void {
    updateSheet((prev) => ({ ...prev, gold: Math.max(0, Math.trunc(next)) }));
  }

  function addEquipmentSlotToInventory(slot: EquipmentEditorSlot): void {
    updateSheet((prev) => addAcquiredEquipmentToSheet(prev, index, slot));
  }

  function buyEquipmentSlot(slot: EquipmentEditorSlot): void {
    const eq = sheetCharacterEquipment(sheet, index);
    const cost = equipmentSlotGoldCost(index, slot, eq);
    if (cost == null) return;
    updateSheet((prev) => {
      const currentGold = prev.gold ?? 0;
      if (currentGold < cost) return prev;
      return addAcquiredEquipmentToSheet(
        { ...prev, gold: currentGold - cost },
        index,
        slot
      );
    });
  }

  function equipInventoryItem(itemId: string, slot: EquippedSlotKey): void {
    updateSheet((prev) => equipInventoryItemOnSheet(prev, itemId, slot, index));
  }

  function unequipInventoryItem(itemId: string, slot: EquippedSlotKey): void {
    updateSheet((prev) => unequipInventoryItemOnSheet(prev, itemId, slot));
  }

  function removeInventoryItem(itemId: string): void {
    updateSheet((prev) => {
      const equipment: CharacterSheetState["equipment"] = { ...prev.equipment };
      (Object.keys(equipment) as EquippedSlotKey[]).forEach((slot) => {
        if (equipment[slot] === itemId) {
          delete equipment[slot];
        }
      });
      return {
        ...prev,
        inventory: prev.inventory.filter((item) => item.id !== itemId),
        equipment
      };
    });
  }

  function togglePowerExpended(powerId: string): void {
    updateSheet((prev) => {
      const used = new Set(prev.powers.expendedPowerIds);
      if (used.has(powerId)) used.delete(powerId);
      else used.add(powerId);
      return {
        ...prev,
        powers: {
          ...prev.powers,
          expendedPowerIds: [...used]
        }
      };
    });
  }

  function applyShortRest(): void {
    const encounterIds = new Set(groupedPowers.encounter.map((power) => power.id));
    updateSheet((prev) => ({
      ...prev,
      resources: refreshSecondWindOnRest(prev.resources),
      powers: {
        ...prev.powers,
        expendedPowerIds: prev.powers.expendedPowerIds.filter((id) => !encounterIds.has(id))
      }
    }));
  }

  const surgeSpendParams = {
    perSurge: Math.max(0, derived.surgeValue),
    capHp: derived.maxHp,
    capSurges: derived.healingSurgesPerDay
  };

  function spendHealingSurge(): void {
    updateSheet((prev) => ({
      ...prev,
      resources: spendHealingSurgeResources(prev.resources, surgeSpendParams)
    }));
  }

  function useSecondWind(): void {
    updateSheet((prev) => ({
      ...prev,
      resources: useSecondWindResources(prev.resources, surgeSpendParams)
    }));
  }

  function applyLongRest(): void {
    updateSheet((prev) => ({
      ...prev,
      resources: refreshSecondWindOnRest({
        ...prev.resources,
        currentHp: derived.maxHp,
        tempHp: 0,
        actionPoints: 1,
        surgesRemaining: derived.healingSurgesPerDay,
        deathSaves: 0
      }),
      powers: {
        ...prev.powers,
        expendedPowerIds: []
      }
    }));
  }

  function setPowerGroupBy(next: PowerSheetGroupBy): void {
    updateSheet((prev) => ({
      ...prev,
      powers: { ...prev.powers, groupBy: next }
    }));
  }

  function getOrderedSectionPowers(sectionPowers: typeof groupedPowers.atWill): typeof groupedPowers.atWill {
    const usedSet = new Set(sheet.powers.expendedPowerIds);
    const manualIndexById = new Map(sheet.powers.manualOrderIds.map((id, idx) => [id, idx]));
    const fallbackIndexById = new Map(sectionPowers.map((power, idx) => [power.id, idx]));
    return [...sectionPowers].sort((a, b) => {
      const aUsed = usedSet.has(a.id);
      const bUsed = usedSet.has(b.id);
      if (aUsed !== bUsed) return aUsed ? 1 : -1;
      const aManual = manualIndexById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bManual = manualIndexById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aManual !== bManual) return aManual - bManual;
      return (fallbackIndexById.get(a.id) ?? 0) - (fallbackIndexById.get(b.id) ?? 0);
    });
  }

  function reorderPowerCardsByDrag(sectionPowers: typeof groupedPowers.atWill, sourcePowerId: string, targetPowerId: string): void {
    if (sourcePowerId === targetPowerId) return;
    const ordered = getOrderedSectionPowers(sectionPowers);
    const usedSet = new Set(sheet.powers.expendedPowerIds);
    const source = ordered.find((power) => power.id === sourcePowerId);
    const target = ordered.find((power) => power.id === targetPowerId);
    if (!source || !target) return;
    const sourceUsed = usedSet.has(source.id);
    const targetUsed = usedSet.has(target.id);
    // Keep "used at bottom" invariant by limiting drag reorder to same-used state.
    if (sourceUsed !== targetUsed) return;

    const sameStateIds = ordered.filter((power) => usedSet.has(power.id) === sourceUsed).map((power) => power.id);
    const sourceIndex = sameStateIds.indexOf(sourcePowerId);
    const targetIndex = sameStateIds.indexOf(targetPowerId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reorderedGroup = [...sameStateIds];
    const [moved] = reorderedGroup.splice(sourceIndex, 1);
    reorderedGroup.splice(targetIndex, 0, moved);

    const groupIdSet = new Set(sameStateIds);
    let groupCursor = 0;
    const reorderedBucketIds = ordered.map((power) =>
      groupIdSet.has(power.id) ? reorderedGroup[groupCursor++] : power.id
    );
    const bucketIdSet = new Set(reorderedBucketIds);

    updateSheet((prev) => ({
      ...prev,
      powers: {
        ...prev.powers,
        manualOrderIds: [...prev.powers.manualOrderIds.filter((id) => !bucketIdSet.has(id)), ...reorderedBucketIds]
      }
    }));
  }

  function buildSelectedConditionDuration() {
    return buildDurationFromPreset(selectedDurationPreset, conditionDurationRounds);
  }

  function addCondition(name: string): void {
    const normalized = name.trim();
    if (!normalized) return;
    const duration = buildSelectedConditionDuration();
    const candidate = createActiveCondition(normalized, duration);
    updateSheet((prev) => {
      if (prev.resources.conditions.some((existing) => areActiveConditionsDuplicate(existing, candidate))) {
        return prev;
      }
      return {
        ...prev,
        resources: {
          ...prev.resources,
          conditions: [...prev.resources.conditions, candidate]
        }
      };
    });
  }

  function removeCondition(id: string): void {
    updateSheet((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        conditions: prev.resources.conditions.filter((existing) => existing.id !== id)
      }
    }));
  }

  function renderConditionDurationSelect(style?: CSSProperties): JSX.Element {
    return (
      <select
        value={selectedDurationPreset}
        onChange={(e) => setSelectedDurationPreset(e.target.value as ConditionDurationPresetKey)}
        aria-label="Condition duration"
        style={{
          fontSize: "0.78rem",
          borderRadius: "0.25rem",
          border: "1px solid var(--panel-border)",
          padding: "0.15rem 0.2rem",
          ...style
        }}
      >
        {CONDITION_DURATION_PRESET_OPTIONS.map((opt) => (
          <option key={opt.key || "none"} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  function renderConditionDurationRoundsInput(): JSX.Element | null {
    if (selectedDurationPreset !== "rounds") return null;
    return (
      <input
        type="number"
        min={1}
        max={99}
        value={conditionDurationRounds}
        onChange={(e) => setConditionDurationRounds(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
        aria-label="Number of rounds"
        style={{
          fontSize: "0.78rem",
          borderRadius: "0.25rem",
          border: "1px solid var(--panel-border)",
          padding: "0.15rem 0.25rem",
          width: "3.2rem"
        }}
      />
    );
  }

  function renderHitPointsPanel(): JSX.Element {
    const hpPanelControlBoxStyle: CSSProperties = {
      alignSelf: "stretch",
      border: "1px solid var(--panel-border)",
      borderRadius: "0.3rem",
      padding: "0.2rem 0.32rem",
      backgroundColor: "var(--surface-1)",
      minWidth: 0
    };

    const restButtonStyle: CSSProperties = {
      ...hpPanelHealButtonStyle,
      padding: "0.14rem 0.32rem",
      borderRadius: "0.22rem",
      border: "1px solid var(--panel-border-strong, var(--panel-border))",
      backgroundColor: "var(--surface-2)",
      color: "var(--text-primary)",
      cursor: "pointer",
      fontWeight: 700,
      flexShrink: 0,
      whiteSpace: "nowrap",
      width: "100%",
      boxSizing: "border-box"
    };

    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "0.35rem",
            alignItems: "stretch",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <label
            style={{
              ...labelStyle,
              padding: "0.28rem 0.35rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.3rem",
              backgroundColor: "var(--surface-1)",
              display: "grid",
              alignContent: "start",
              gap: "0.2rem"
            }}
          >
            <span
              tabIndex={0}
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "hp")}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onFocus={(event) => glossaryTooltipUi.startHover(event, "hp")}
              onBlur={glossaryTooltipUi.leaveHover}
            >
              Hit Points
            </span>
            <AdjustableNumberInput
              compact
              max={derived.maxHp}
              companionMax={derived.maxHp}
              value={sheet.resources.currentHp}
              onChange={(next) =>
                updateSheet((prev) => ({
                  ...prev,
                  resources: {
                    ...prev.resources,
                    currentHp: Math.min(next, derived.maxHp)
                  }
                }))
              }
              ariaLabel="Current hit points"
            />
          </label>
          <label
            style={{
              ...labelStyle,
              ...hpPanelShrinkableBoxStyle,
              padding: "0.28rem 0.35rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.3rem",
              backgroundColor: "var(--surface-0)"
            }}
          >
            <span
              tabIndex={0}
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "tempHp")}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onFocus={(event) => glossaryTooltipUi.startHover(event, "tempHp")}
              onBlur={glossaryTooltipUi.leaveHover}
            >
              Temp HP
            </span>
            <AdjustableNumberInput
              compact
              min={0}
              value={sheet.resources.tempHp}
              onChange={(next) =>
                updateSheet((prev) => ({
                  ...prev,
                  resources: {
                    ...prev.resources,
                    tempHp: Math.max(0, next)
                  }
                }))
              }
              ariaLabel="Temporary hit points"
            />
          </label>
          <label
            style={{
              ...labelStyle,
              ...hpPanelShrinkableBoxStyle,
              padding: "0.28rem 0.35rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.3rem",
              backgroundColor: "var(--surface-0)"
            }}
          >
            <span
              tabIndex={0}
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "actionPoints")}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onFocus={(event) => glossaryTooltipUi.startHover(event, "actionPoints")}
              onBlur={glossaryTooltipUi.leaveHover}
            >
              Action Pts
            </span>
            <AdjustableNumberInput
              compact
              min={0}
              max={9}
              value={sheet.resources.actionPoints}
              onChange={(next) =>
                updateSheet((prev) => ({
                  ...prev,
                  resources: {
                    ...prev.resources,
                    actionPoints: clamp(next, 0, 9)
                  }
                }))
              }
              ariaLabel="Action points"
            />
          </label>
          <div
            style={{
              ...hpPanelControlBoxStyle,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "0.22rem"
            }}
          >
            <button type="button" onClick={applyShortRest} style={restButtonStyle} {...glossaryTooltipUi.hoverA11y("shortRest")}>
              Short rest
            </button>
            <button type="button" onClick={applyLongRest} style={restButtonStyle} {...glossaryTooltipUi.hoverA11y("extendedRest")}>
              Long rest
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
            gap: "0.35rem",
            alignItems: "stretch",
            marginTop: "0.35rem",
            minWidth: 0,
            maxWidth: "100%",
            boxSizing: "border-box"
          }}
        >
          <label
            style={{
              ...labelStyle,
              ...hpPanelShrinkableBoxStyle,
              padding: "0.28rem 0.35rem",
              border: "1px solid var(--panel-border)",
              borderRadius: "0.3rem",
              backgroundColor: "var(--surface-0)",
              alignSelf: "stretch",
              display: "grid",
              alignContent: "start",
              gap: "0.2rem"
            }}
          >
            <span
              tabIndex={0}
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "deathSaves")}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onFocus={(event) => glossaryTooltipUi.startHover(event, "deathSaves")}
              onBlur={glossaryTooltipUi.leaveHover}
            >
              Death Saves
            </span>
            <DeathSaveCheckboxes
              value={sheet.resources.deathSaves}
              onChange={(next) =>
                updateSheet((prev) => ({
                  ...prev,
                  resources: {
                    ...prev.resources,
                    deathSaves: clamp(next, 0, 3)
                  }
                }))
              }
            />
          </label>
          <div
            style={{
              ...hpPanelResourceFieldBoxStyle,
              ...hpPanelShrinkableBoxStyle,
              display: "grid",
              gap: "0.2rem",
              alignContent: "start",
              minWidth: 0
            }}
          >
            <HealingSurgesFieldLabel
              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "surges")}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              onFocus={(event) => glossaryTooltipUi.startHover(event, "surges")}
              onBlur={glossaryTooltipUi.leaveHover}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                flexWrap: "wrap",
                minWidth: 0
              }}
            >
                <AdjustableNumberInput
                  compact
                  min={0}
                  max={derived.healingSurgesPerDay}
                  companionMax={derived.healingSurgesPerDay}
                  value={sheet.resources.surgesRemaining}
                  onChange={(next) =>
                    updateSheet((prev) => ({
                      ...prev,
                      resources: {
                        ...prev.resources,
                        surgesRemaining: clamp(next, 0, derived.healingSurgesPerDay)
                      }
                    }))
                  }
                  ariaLabel="Healing surges remaining"
                  style={{ flexShrink: 0 }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => spendHealingSurge()}
                    disabled={sheet.resources.surgesRemaining === 0}
                    aria-label="Spend Surge"
                    style={{
                      ...hpPanelHealButtonStyle,
                      cursor: sheet.resources.surgesRemaining === 0 ? "not-allowed" : "pointer",
                      opacity: sheet.resources.surgesRemaining === 0 ? 0.55 : 1
                    }}
                  >
                    Spend Surge
                  </button>
                  <button
                    type="button"
                    onClick={() => useSecondWind()}
                    disabled={!canUseSecondWind(sheet.resources)}
                    {...glossaryTooltipUi.hoverA11y("secondWind")}
                    style={{
                      ...hpPanelHealButtonStyle,
                      cursor: canUseSecondWind(sheet.resources) ? "pointer" : "not-allowed",
                      opacity: canUseSecondWind(sheet.resources) ? 1 : 0.55
                    }}
                  >
                    Second Wind
                  </button>
                </div>
                <HealingSurgeValueHint
                  surgeValue={derived.surgeValue}
                  onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "surgeValue")}
                  onMouseLeave={glossaryTooltipUi.leaveHover}
                  onFocus={(event) => glossaryTooltipUi.startHover(event, "surgeValue")}
                  onBlur={glossaryTooltipUi.leaveHover}
                />
              </div>
          </div>
        </div>
      </>
    );
  }

  function renderGlossaryStatLabel(row: ScoreBreakdownRowDef, _stripe: string): ReactNode {
    const glossaryKey = row.glossaryKey ?? row.rowKey;
    return (
      <span
        {...glossaryTooltipUi.hoverA11y(glossaryKey)}
        style={{
          fontWeight: 600,
          color: "var(--text-primary)",
          whiteSpace: "nowrap"
        }}
      >
        {row.label}
      </span>
    );
  }

  function renderAbilityScoreLabel(row: ScoreBreakdownRowDef, stripe: string): ReactNode {
    const glossaryKey = row.glossaryKey ?? `ability:${row.rowKey}`;
    return (
      <span
        tabIndex={0}
        onMouseEnter={(event) => glossaryTooltipUi.startHover(event, glossaryKey)}
        onMouseLeave={glossaryTooltipUi.leaveHover}
        onFocus={(event) => glossaryTooltipUi.startHover(event, glossaryKey)}
        onBlur={glossaryTooltipUi.leaveHover}
        style={{
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--text-primary)",
          padding: "0.12rem 0.2rem",
          ...(stripe !== "transparent" ? { backgroundColor: stripe, borderRadius: "0.2rem" } : {}),
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {row.label}
      </span>
    );
  }

  function renderSpeedInitiativePanel(): JSX.Element {
    return (
      <ScoreBreakdownTable
          className="character-sheet-motion-panel"
          variant="stat"
          compact
          columns={MOTION_SCORE_COLUMNS}
          bonusHeader={null}
          labelHeader={null}
          prioritizeLabel
          rows={[
            {
              rowKey: "speed",
              label: "Speed",
              glossaryKey: "speed",
              total: derived.speed,
              values: motionUnifiedRowValues(derived.speedBreakdown.components, "speed")
            },
            {
              rowKey: "initiative",
              label: "Initiative",
              glossaryKey: "initiative",
              total: derived.initiative,
              signedTotal: true,
              values: motionUnifiedRowValues(derived.initiativeBreakdown.components, "initiative")
            }
          ]}
          renderLabel={renderGlossaryStatLabel}
      />
    );
  }

  function renderConditionsPanel(): JSX.Element {
    const isBloodied = sheet.resources.currentHp <= derived.bloodied;
    const isDead = sheet.resources.currentHp <= -derived.bloodied || sheet.resources.deathSaves >= 3;
    const isDying = sheet.resources.currentHp <= 0 && !isDead;

    return (
      <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", backgroundColor: "var(--surface-1)", padding: "0.4rem", display: "grid", gap: "0.25rem", alignContent: "start" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          Conditions
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              selectedConditionOption && selectedConditionOption !== "__custom__"
                ? selectedDurationPreset === "rounds"
                  ? "1fr auto 3.2rem auto"
                  : "1fr auto auto"
                : "1fr",
            gap: "0.2rem",
            alignItems: "center"
          }}
        >
          <select
              value={selectedConditionOption}
              onChange={(e) => setSelectedConditionOption(e.target.value)}
              style={{ fontSize: "0.78rem", borderRadius: "0.25rem", border: "1px solid var(--panel-border)", padding: "0.15rem 0.2rem" }}
            >
              <option value="">Add condition...</option>
              {GLOSSARY_CONDITION_OPTIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
              <option value="__custom__">Custom condition...</option>
            </select>
            {selectedConditionOption && selectedConditionOption !== "__custom__" && (
              <>
                {renderConditionDurationSelect()}
                {renderConditionDurationRoundsInput()}
                <button
                  type="button"
                  onClick={() => {
                    addCondition(selectedConditionOption);
                    setSelectedConditionOption("");
                  }}
                  style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem", whiteSpace: "nowrap" }}
                >
                  Add
                </button>
              </>
            )}
        </div>
        {selectedConditionOption === "__custom__" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: selectedDurationPreset === "rounds" ? "1fr auto 3.2rem auto" : "1fr auto auto",
                gap: "0.2rem",
                alignItems: "center"
              }}
            >
              <input
                type="text"
                value={customConditionText}
                onChange={(e) => setCustomConditionText(e.target.value)}
                placeholder="Enter custom condition"
                style={{ fontSize: "0.78rem", borderRadius: "0.25rem", border: "1px solid var(--panel-border)", padding: "0.15rem 0.25rem" }}
              />
              {renderConditionDurationSelect()}
              {renderConditionDurationRoundsInput()}
              <button
                type="button"
                onClick={() => {
                  addCondition(customConditionText);
                  setCustomConditionText("");
                }}
                style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem", whiteSpace: "nowrap" }}
              >
                Add
              </button>
            </div>
        )}
        {(isBloodied || isDying || isDead) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
            {isBloodied && (
              <div
                onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "bloodied")}
                onMouseLeave={glossaryTooltipUi.leaveHover}
                style={conditionBadgeStyle("bloodied")}
              >
                {conditionDisplayLabel("Bloodied")}
              </div>
            )}
            {isDying && (
              <div
                onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "dying")}
                onMouseLeave={glossaryTooltipUi.leaveHover}
                style={conditionBadgeStyle("dying")}
              >
                {conditionDisplayLabel("Dying")}
              </div>
            )}
            {isDead && (
              <div
                onMouseEnter={(event) => glossaryTooltipUi.startHover(event, "dead")}
                onMouseLeave={glossaryTooltipUi.leaveHover}
                style={conditionBadgeStyle("dead")}
              >
                {conditionDisplayLabel("Dead")}
              </div>
            )}
          </div>
        )}
        {sheet.resources.conditions.length === 0 && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>None</div>
        )}
        {sheet.resources.conditions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.25rem" }}>
            {sheet.resources.conditions.map((condition) => {
              const durationPhrase = conditionDurationDisplayPhrase(condition.duration);
              return (
                <div
                  key={condition.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "0.25rem",
                    alignItems: "center",
                    width: "auto",
                    ...conditionBadgeStyle(condition.name)
                  }}
                >
                  <span
                    onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `condition:${condition.name}`)}
                    onFocus={(event) => glossaryTooltipUi.startHover(event, `condition:${condition.name}`)}
                    onMouseLeave={glossaryTooltipUi.leaveHover}
                    onBlur={glossaryTooltipUi.leaveHover}
                    tabIndex={0}
                    style={{ display: "flex", flexDirection: "column", gap: "0.05rem", minWidth: 0 }}
                  >
                    <span>{conditionDisplayLabel(condition.name)}</span>
                    {durationPhrase ? (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 600,
                          textTransform: "none",
                          letterSpacing: "0.02em",
                          opacity: 0.9,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {durationPhrase}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCondition(condition.id)}
                    style={{
                      border: "1px solid var(--panel-border-strong)",
                      borderRadius: "0.2rem",
                      backgroundColor: "var(--surface-0)",
                      color: "var(--text-secondary)",
                      fontSize: "0.7rem",
                      lineHeight: 1,
                      padding: "0.05rem 0.2rem",
                      cursor: "pointer"
                    }}
                    aria-label={`Remove ${condition.name}`}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderDefensesPanel(): JSX.Element {
    const bd = derived.acBreakdown;
    const secondWindBonus = hasSecondWindDefenseBonus(sheet.resources.conditions) ? SECOND_WIND_DEFENSE_BONUS : 0;
    const magicAcBonus = derived.defenses.ac - bd.total;
    const acComponents = buildAcScoreComponents(bd, { magicItemBonus: magicAcBonus, secondWindBonus });
    return (
      <>
        <ScoreBreakdownTable
          variant="stat"
          compact
          columns={DEFENSE_SCORE_COLUMNS}
          bonusHeader={null}
          labelHeader="DEFENSE"
          prioritizeLabel
          rows={[
            {
              rowKey: "ac",
              label: "AC",
              glossaryKey: "ac",
              total: derived.defenses.ac + secondWindBonus,
              values: defenseRowValues(acComponents)
            },
            {
              rowKey: "fortitude",
              label: "Fortitude",
              glossaryKey: "fortitude",
              total: derived.defenses.fortitude + secondWindBonus,
              values: defenseRowValues(derived.fortitudeBreakdown.components, secondWindBonus)
            },
            {
              rowKey: "reflex",
              label: "Reflex",
              glossaryKey: "reflex",
              total: derived.defenses.reflex + secondWindBonus,
              values: defenseRowValues(derived.reflexBreakdown.components, secondWindBonus)
            },
            {
              rowKey: "will",
              label: "Will",
              glossaryKey: "will",
              total: derived.defenses.will + secondWindBonus,
              values: defenseRowValues(derived.willBreakdown.components, secondWindBonus)
            }
          ]}
          renderLabel={renderGlossaryStatLabel}
        />
        {derived.armorCheckPenalty > 0 && (
          <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.82rem", color: "var(--status-warning)" }}>
            Armor check penalty -{derived.armorCheckPenalty} on untrained Strength / Dexterity skills (see Skills).
          </p>
        )}
      </>
    );
  }

  function renderAttackPreviewPanel(): JSX.Element | null {
    if (!mainWeaponSummary && !offHandWeaponSummary && !implementAttackSummary) return null;
    return (
      <OverviewCollapsibleSection title="Basic Attacks" defaultOpen={false}>
        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.74rem", color: "var(--text-muted)" }}>
            Half-level + ability + proficiency (or nonproficient -2). Equip weapons in Main / Off hand and an implement in the implement slot.
          </p>
          {mainWeaponSummary && mainHandWeapon && (
            <p style={{ margin: "0.15rem 0" }}>
              <strong>Weapon (main):</strong> {mainHandWeapon.name} ? attack{" "}
              {mainWeaponSummary.attackBonus >= 0 ? "+" : ""}
              {mainWeaponSummary.attackBonus} vs AC ({mainWeaponSummary.abilityCode}); damage {mainWeaponSummary.damageNotation}
              {!mainWeaponSummary.proficient && (
                <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient -2 applied in bonus)</span>
              )}
            </p>
          )}
          {offHandWeaponSummary && offHandWeapon && (
            <p style={{ margin: "0.15rem 0" }}>
              <strong>Weapon (off):</strong> {offHandWeapon.name} ? attack{" "}
              {offHandWeaponSummary.attackBonus >= 0 ? "+" : ""}
              {offHandWeaponSummary.attackBonus} vs AC ({offHandWeaponSummary.abilityCode}); damage {offHandWeaponSummary.damageNotation}
              {!offHandWeaponSummary.proficient && (
                <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient -2 applied in bonus)</span>
              )}
            </p>
          )}
          {implementAttackSummary && equippedImplement && (
            <p style={{ margin: "0.15rem 0" }}>
              <strong>Implement:</strong> {equippedImplement.name} ? attack{" "}
              {implementAttackSummary.attackBonus >= 0 ? "+" : ""}
              {implementAttackSummary.attackBonus} vs AC (best key ability)
              {!implementAttackSummary.proficient && (
                <span style={{ color: "var(--status-warning)", marginLeft: "0.25rem" }}>(nonproficient -2 applied in bonus)</span>
              )}
            </p>
          )}
        </div>
      </OverviewCollapsibleSection>
    );
  }

  function startRaceHoverInfoTimer(event: ReactMouseEvent<HTMLElement>): void {
    if (!derived.race) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setRaceHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 360, maxHeightVh: 52 }));
    if (raceHoverTimerRef.current != null) {
      window.clearTimeout(raceHoverTimerRef.current);
    }
    raceHoverTimerRef.current = window.setTimeout(() => {
      setShowRaceHoverInfo(true);
      raceHoverTimerRef.current = null;
    }, GLOSSARY_TOOLTIP_OPEN_DELAY_MS);
  }

  function stopRaceHoverInfoTimerAndHide(): void {
    if (raceHoverTimerRef.current != null) {
      window.clearTimeout(raceHoverTimerRef.current);
      raceHoverTimerRef.current = null;
    }
    setShowRaceHoverInfo(false);
    setRaceHoverPanelPos(null);
  }

  function startClassHoverInfoTimer(event: ReactMouseEvent<HTMLElement>): void {
    if (!derived.cls) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setClassHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 380, maxHeightVh: 52 }));
    if (classHoverTimerRef.current != null) {
      window.clearTimeout(classHoverTimerRef.current);
    }
    classHoverTimerRef.current = window.setTimeout(() => {
      setShowClassHoverInfo(true);
      classHoverTimerRef.current = null;
    }, GLOSSARY_TOOLTIP_OPEN_DELAY_MS);
  }

  function stopClassHoverInfoTimerAndHide(): void {
    if (classHoverTimerRef.current != null) {
      window.clearTimeout(classHoverTimerRef.current);
      classHoverTimerRef.current = null;
    }
    setShowClassHoverInfo(false);
    setClassHoverPanelPos(null);
  }

  return (
    <div
      style={{
        padding: "clamp(0.65rem, 1.4vw, 1rem)",
        maxWidth: "1440px",
        margin: "0 auto",
        boxSizing: "border-box",
        background: "var(--character-sheet-background, linear-gradient(180deg, var(--surface-1) 0%, var(--surface-1) 100%))",
        minHeight: "100%",
        minWidth: 0,
        color: "var(--character-sheet-foreground)"
      }}
    >
      <div style={{ marginBottom: "0.25rem", fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-primary)" }}>
        D&D 4e Character Sheet
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        {(Object.keys(tabLabel) as SheetTab[]).map((key) => (
          <button
            key={key}
            type="button"
            disabled={tab === key}
            onClick={() => setTab(key)}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.3rem",
              border: tab === key ? "1px solid var(--surface-3)" : "1px solid var(--panel-border)",
              backgroundColor: tab === key ? "var(--surface-3)" : "var(--surface-0)",
              color: tab === key ? "var(--surface-0)" : "var(--text-primary)",
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              fontSize: "0.78rem",
              cursor: tab === key ? "default" : "pointer"
            }}
          >
            {tabLabel[key]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ ...panelStyle, display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", minWidth: 0 }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <select value={selectedSavedCharacterId} onChange={(e) => setSelectedSavedCharacterId(e.target.value)}>
              <option value="">Load saved Builder character...</option>
              {savedCharacters.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({new Date(entry.updatedAt).toLocaleString()})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const selected = savedCharacters.find((entry) => entry.id === selectedSavedCharacterId);
                if (!selected) return;
                setSheet(sheetStateFromBuild(selected.build, index));
              }}
              disabled={!selectedSavedCharacterId}
            >
              Load Into Sheet
            </button>
          </div>
          <div className="character-sheet-overview-row" style={{ ...overviewThreeColumnGridStyle, gridColumn: "1 / -1" }}>
            <div style={overviewSideColumnStyle}>
              <CharacterIdentitySection
                name={sheet.name}
                raceName={derived.race?.name ?? ""}
                classDisplay={
                  sheet.characterStyle === "hybrid" && hybridClassA && hybridClassB
                    ? `${hybridClassA.name} / ${hybridClassB.name}`
                    : derived.cls?.name ?? ""
                }
                level={sheet.level}
                themeName={sheet.themeId ? (selectedTheme?.name ?? sheet.themeId) : undefined}
                paragonPathName={sheet.paragonPathId ? (selectedParagonPath?.name ?? sheet.paragonPathId) : undefined}
                epicDestinyName={sheet.epicDestinyId ? (selectedEpicDestiny?.name ?? sheet.epicDestinyId) : undefined}
                onRaceLabelMouseEnter={derived.race ? startRaceHoverInfoTimer : undefined}
                onRaceLabelMouseLeave={derived.race ? stopRaceHoverInfoTimerAndHide : undefined}
                onClassLabelMouseEnter={
                  derived.cls || (hybridClassA && hybridClassB) ? startClassHoverInfoTimer : undefined
                }
                onClassLabelMouseLeave={
                  derived.cls || (hybridClassA && hybridClassB) ? stopClassHoverInfoTimerAndHide : undefined
                }
                onLevelLabelMouseEnter={(event) => glossaryTooltipUi.startHover(event, "level")}
                onLevelLabelMouseLeave={glossaryTooltipUi.leaveHover}
                onLevelLabelFocus={(event) => glossaryTooltipUi.startHover(event, "level")}
                onLevelLabelBlur={glossaryTooltipUi.leaveHover}
              />
              <OverviewCollapsibleSection
                title="Ability Scores"
                titleTabIndex={0}
                onTitleMouseEnter={(event) => glossaryTooltipUi.startHover(event, "abilityScores")}
                onTitleMouseLeave={glossaryTooltipUi.leaveHover}
                onTitleFocus={(event) => glossaryTooltipUi.startHover(event, "abilityScores")}
                onTitleBlur={glossaryTooltipUi.leaveHover}
              >
                <ScoreBreakdownTable
                  variant="stat"
                  columns={ABILITY_SCORE_COLUMNS}
                  labelHeader={null}
                  rows={(["STR", "CON", "DEX", "INT", "WIS", "CHA"] as const).map((ab) => ({
                    rowKey: ab,
                    label: ab,
                    glossaryKey: `ability:${ab}`,
                    total: derived.abilityMods[ab],
                    signedTotal: true,
                    values: { score: sheet.abilityScores[ab] }
                  }))}
                  renderLabel={renderAbilityScoreLabel}
                />
              </OverviewCollapsibleSection>
              <OverviewCollapsibleSection title="Skills">
                <ScoreBreakdownTable
                  variant="skill"
                  columns={SKILL_BREAKDOWN_COLUMNS}
                  rows={skillRowsToBreakdown(skillRows)}
                  fontSize="0.76rem"
                  formatTotalValue={(row) => formatSkillBreakdownTotal(skillRowMap(skillRows).get(row.rowKey)!)}
                  formatComponentValue={(row, columnKey) =>
                    formatSkillBreakdownComponent(skillRowMap(skillRows).get(row.rowKey)!, columnKey)
                  }
                  renderLabel={(row, stripe) => {
                    const skill = skillRowMap(skillRows).get(row.rowKey)!;
                    return (
                      <SkillModifierNameContent
                        row={skill}
                        onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `skill:${skill.skillId}`)}
                        onMouseLeave={glossaryTooltipUi.leaveHover}
                        onFocus={(event) => glossaryTooltipUi.startHover(event, `skill:${skill.skillId}`)}
                        onBlur={glossaryTooltipUi.leaveHover}
                        tabIndex={0}
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          padding: "0.12rem 0.2rem",
                          borderRadius: "0.2rem",
                          backgroundColor: stripe
                        }}
                      />
                    );
                  }}
                />
              </OverviewCollapsibleSection>
            </div>
            <div style={overviewCenterColumnStyle}>
              <OverviewCollapsibleSection title={racialTraitsSectionTitle}>
                <TraitRowsList
                  rows={racialTraitRows.map(({ trait }) => trait)}
                  emptyMessage={
                    !derived.race
                      ? "No race selected."
                      : traitsEmptyMessage(derived.race?.name, "No racial traits listed.")
                  }
                />
              </OverviewCollapsibleSection>
              {showClassTraits && (
                <OverviewCollapsibleSection title={classTraitsSectionTitle}>
                  <TraitRowsList
                    rows={classTraitRows}
                    emptyMessage={traitsEmptyMessage(
                      sheet.characterStyle === "hybrid" && hybridClassA && hybridClassB
                        ? `${hybridClassA.name} / ${hybridClassB.name}`
                        : derived.cls?.name,
                      "No class traits listed."
                    )}
                  />
                </OverviewCollapsibleSection>
              )}
              {showThemeTraits && (
                <OverviewCollapsibleSection title={themeTraitsSectionTitle}>
                  <TraitRowsList
                    rows={themeTraitRows}
                    emptyMessage={traitsEmptyMessage(selectedTheme?.name, "No theme traits listed.")}
                  />
                </OverviewCollapsibleSection>
              )}
            </div>
            <div style={overviewSideColumnStyle}>
              {showParagonTraits && (
                <OverviewCollapsibleSection title={paragonTraitsSectionTitle}>
                  <TraitRowsList
                    rows={paragonTraitRows}
                    emptyMessage={traitsEmptyMessage(selectedParagonPath?.name, "No paragon traits listed.")}
                  />
                </OverviewCollapsibleSection>
              )}
              {showEpicDestinyTraits && (
                <OverviewCollapsibleSection title={epicDestinyTraitsSectionTitle}>
                  <TraitRowsList
                    rows={epicDestinyTraitRows}
                    emptyMessage={traitsEmptyMessage(selectedEpicDestiny?.name, "No epic destiny traits listed.")}
                  />
                </OverviewCollapsibleSection>
              )}
              <OverviewCollapsibleSection title="Feats">
                <TraitRowsList
                  rows={selectedFeatRows.map((feat) => ({
                    id: feat.id,
                    name: feat.name,
                    shortDescription: feat.shortDescription
                  }))}
                  emptyMessage="No feats selected."
                />
              </OverviewCollapsibleSection>
              {featGrantedTraitRows.length > 0 && (
                <OverviewCollapsibleSection title="Granted by feats">
                  <TraitRowsList rows={featGrantedTraitRows} emptyMessage="No feat-granted features." />
                </OverviewCollapsibleSection>
              )}
              {featGrantedPowerRows.length > 0 && (
                <OverviewCollapsibleSection title="Feat powers">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {featGrantedPowerRows.map(({ feat, powers }) => (
                      <div key={feat.id} style={{ fontSize: "0.8rem" }}>
                        <div style={{ fontWeight: 700, marginBottom: "0.12rem" }}>{feat.name}</div>
                        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--text-secondary)" }}>
                          {powers.map((p) => (
                            <li key={p.id}>
                              {p.name}
                              {p.usage ? ` (${p.usage})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </OverviewCollapsibleSection>
              )}
              {featProficiencyDisplayRows.length > 0 && (
                <OverviewCollapsibleSection title="Proficiencies from feats">
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                    {featProficiencyDisplayRows.map((row) => (
                      <li key={row.featId} style={{ marginBottom: "0.35rem" }}>
                        <span style={{ fontWeight: 700 }}>{row.featName}</span>
                        <ul style={{ margin: "0.12rem 0 0 0", paddingLeft: "1rem", color: "var(--text-secondary)" }}>
                          {row.grants.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </OverviewCollapsibleSection>
              )}
            </div>
            </div>
            <div
              className="character-sheet-overview-row character-sheet-overview-row--page-break"
              style={{ ...overviewThreeColumnGridStyle, gridColumn: "1 / -1" }}
            >
            <div style={overviewSideColumnStyle}>
                {renderDefensesPanel()}
                {renderSpeedInitiativePanel()}
                {renderAttackPreviewPanel()}
            </div>
            <div style={overviewCenterColumnStyle}>
              {renderHitPointsPanel()}
            </div>
            <div style={overviewSideColumnStyle}>
              {renderConditionsPanel()}
            </div>
            </div>
          <div style={{ ...panelStyle, gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              Group powers by
            </span>
            {(
              [
                { key: "usage" as const, label: "Usage" },
                { key: "actionType" as const, label: "Action type" }
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                disabled={powerGroupBy === key}
                onClick={() => setPowerGroupBy(key)}
                style={{
                  padding: "0.3rem 0.65rem",
                  borderRadius: "0.3rem",
                  border: powerGroupBy === key ? "1px solid var(--surface-3)" : "1px solid var(--panel-border)",
                  backgroundColor: powerGroupBy === key ? "var(--surface-3)" : "var(--surface-0)",
                  color: powerGroupBy === key ? "var(--surface-0)" : "var(--text-primary)",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  fontSize: "0.76rem",
                  cursor: powerGroupBy === key ? "default" : "pointer"
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {powerDisplaySections.map((section) => (
            <div key={section.key} style={{ ...panelStyle, gridColumn: "1 / -1" }}>
                {section.sectionKind === "usage" && section.usageBucket ? (
                  <div
                    onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerUsage:${section.usageBucket}`)}
                    onMouseLeave={glossaryTooltipUi.leaveHover}
                    onFocus={(event) => glossaryTooltipUi.startHover(event, `powerUsage:${section.usageBucket}`)}
                    onBlur={glossaryTooltipUi.leaveHover}
                    tabIndex={0}
                    style={{
                      fontWeight: 700,
                      marginBottom: "0.35rem",
                      borderLeft: `5px solid ${powerCardUsageAccentBarColor(section.usageBucket)}`,
                      paddingLeft: "0.45rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-primary)"
                    }}
                  >
                    {section.title}
                  </div>
                ) : (
                  <div
                    style={{
                      fontWeight: 700,
                      marginBottom: "0.35rem",
                      borderLeft: "5px solid var(--panel-border)",
                      paddingLeft: "0.45rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-primary)"
                    }}
                  >
                    {section.title}
                  </div>
                )}
                {(() => {
                  const orderedSectionPowers = getOrderedSectionPowers(section.powers);
                  const usedSet = new Set(sheet.powers.expendedPowerIds);
                  return orderedSectionPowers.length === 0 ? (
                  <div style={{ color: "var(--text-muted)" }}>No cards selected.</div>
                ) : (
                  <div style={{ display: "grid", gap: "0.4rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "stretch" }}>
                    {orderedSectionPowers.map((power) => {
                    const usageBucket = powerUsageBucket(power);
                    const expended = usedSet.has(power.id);
                    const canExpend = usageBucket === "encounter" || usageBucket === "daily";
                      return (
                      <CharacterPowerCard
                        key={power.id}
                        power={power}
                        variant="sheet"
                        showInsetShadow
                        expended={expended}
                        showExpendedBadge
                        shellStyle={{
                          opacity: expended ? 0.58 : 1,
                          filter: expended ? "grayscale(0.55) saturate(0.65) brightness(0.88) contrast(0.82)" : "none",
                          cursor: "grab"
                        }}
                        draggable
                        onDragStart={() => setDraggingPowerId(power.id)}
                        onDragEnd={() => setDraggingPowerId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggingPowerId) return;
                          reorderPowerCardsByDrag(section.powers, draggingPowerId, power.id);
                          setDraggingPowerId(null);
                        }}
                        renderKeyword={(keyword) => {
                          const isParalysisKeyword = keyword.trim().toLowerCase() === "paralysis";
                          if (isParalysisKeyword) {
                            return <span style={{ color: "var(--text-primary)" }}>{keyword}</span>;
                          }
                          return (
                            <span
                              onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${keyword}`)}
                              onFocus={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${keyword}`)}
                              onMouseLeave={glossaryTooltipUi.leaveHover}
                              onBlur={glossaryTooltipUi.leaveHover}
                              tabIndex={0}
                              style={{
                                color: "var(--text-primary)",
                                cursor: "help",
                                textDecoration: "underline dotted",
                                textUnderlineOffset: "2px"
                              }}
                            >
                              {keyword}
                            </span>
                          );
                        }}
                        renderLineText={(text, segmentKey, line) => {
                          if (line.label === "Action" && hasGlossaryHoverForTerm(text)) {
                            return (
                              <span
                                onMouseEnter={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${text}`)}
                                onFocus={(event) => glossaryTooltipUi.startHover(event, `powerKeyword:${text}`)}
                                onMouseLeave={glossaryTooltipUi.leaveHover}
                                onBlur={glossaryTooltipUi.leaveHover}
                                tabIndex={0}
                                style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: "2px" }}
                              >
                                {text}
                              </span>
                            );
                          }
                          return renderPowerTextWithGlossaryHovers(text, segmentKey);
                        }}
                        renderBody={(body) => (
                          <RulesRichText
                            text={body}
                            paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: "0 0 0.35rem 0" }}
                            listItemStyle={{ fontSize: "0.8rem", color: "var(--text-primary)" }}
                          />
                        )}
                        footer={
                          canExpend ? (
                            <button type="button" onClick={() => togglePowerExpended(power.id)}>
                              {expended ? "Mark Ready" : "Mark Used"}
                            </button>
                          ) : null
                        }
                      />
                      );
                    })}
                  </div>
                );

                })()}
            </div>
          ))}
          {showRaceHoverInfo && derived.race && raceHoverPanelPos && (
            <div
              style={{
                position: "fixed",
                top: raceHoverPanelPos.top,
                left: raceHoverPanelPos.left,
                transform: raceHoverPanelPos.transform ?? "none",
                width: "360px",
                maxHeight: "52vh",
                overflow: "auto",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--surface-0)",
                borderRadius: "0.35rem",
                padding: "0.45rem 0.5rem",
                color: "var(--text-primary)",
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
                fontSize: "0.76rem",
                lineHeight: 1.35,
                zIndex: 1000,
                boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)"
              }}
            >
              <div><strong>Race:</strong> {derived.race.name}</div>
              <div><strong>Speed:</strong> {derived.race.speed ?? "-"}</div>
              <div><strong>Size:</strong> {derived.race.size ?? "-"}</div>
              <div><strong>Abilities:</strong> {derived.race.abilitySummary ?? "-"}</div>
              <div><strong>Languages:</strong> {derived.race.languages ?? "-"}</div>
              {typeof derived.race.raw?.body === "string" && derived.race.raw.body.trim() && (
                <div style={{ marginTop: "0.3rem" }}>
                  <RulesRichText
                    text={derived.race.raw.body}
                    paragraphStyle={{ margin: "0 0 0.25rem 0", fontSize: "0.76rem", color: "var(--text-primary)" }}
                    listItemStyle={{ fontSize: "0.76rem", color: "var(--text-primary)" }}
                  />
                </div>
              )}
            </div>
          )}
          {showClassHoverInfo && derived.cls && classHoverPanelPos && (
            <div
              style={{
                position: "fixed",
                top: classHoverPanelPos.top,
                left: classHoverPanelPos.left,
                transform: classHoverPanelPos.transform ?? "none",
                width: "380px",
                maxHeight: "52vh",
                overflow: "auto",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--surface-0)",
                borderRadius: "0.35rem",
                padding: "0.45rem 0.5rem",
                color: "var(--text-primary)",
                textTransform: "none",
                letterSpacing: "normal",
                fontWeight: 500,
                fontSize: "0.76rem",
                lineHeight: 1.35,
                zIndex: 1000,
                boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)"
              }}
            >
              <div><strong>Class:</strong> {derived.cls.name}</div>
              <div><strong>Role:</strong> {derived.cls.role ?? "-"}</div>
              <div><strong>Power Source:</strong> {derived.cls.powerSource ?? "-"}</div>
              <div><strong>Key Abilities:</strong> {derived.cls.keyAbilities ?? "-"}</div>
              <div><strong>HP at 1:</strong> {derived.cls.hitPointsAt1 ?? "-"}</div>
              <div><strong>HP per Level:</strong> {derived.cls.hitPointsPerLevel ?? "-"}</div>
              <div><strong>Healing Surges:</strong> {derived.cls.healingSurgesBase ?? "-"}</div>
              {typeof derived.cls.raw?.body === "string" && derived.cls.raw.body.trim() && (
                <div style={{ marginTop: "0.3rem" }}>
                  <RulesRichText
                    text={derived.cls.raw.body}
                    paragraphStyle={{ margin: "0 0 0.25rem 0", fontSize: "0.76rem", color: "var(--text-primary)" }}
                    listItemStyle={{ fontSize: "0.76rem", color: "var(--text-primary)" }}
                  />
                </div>
              )}
            </div>
          )}
          {glossaryTooltipUi.showPanel && glossaryTooltipUi.hoverKey && glossaryTooltipUi.panelPos && (
            <div
              id={CHARACTER_SHEET_GLOSSARY_TOOLTIP_ID}
              role="tooltip"
              onMouseEnter={glossaryTooltipUi.cancelPendingClose}
              onMouseLeave={glossaryTooltipUi.leaveHover}
              style={{
                position: "fixed",
                top: glossaryTooltipUi.panelPos.top,
                left: glossaryTooltipUi.panelPos.left,
                transform: glossaryTooltipUi.panelPos.transform ?? "none",
                ...STANDARD_GLOSSARY_TOOLTIP_PANEL_STYLE
              }}
            >
              {glossaryContent(glossaryTooltipUi.hoverKey as GlossaryKey)}
            </div>
          )}
        </div>
      )}

      {tab === "equipment" && (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          <EquipmentTab
            index={index}
            build={sheetEquipmentBuild}
            magicCombat={magicCombat}
            gold={sheet.gold ?? 0}
            onGoldChange={setGold}
            onAddToInventory={addEquipmentSlotToInventory}
            onBuy={buyEquipmentSlot}
            onBuildChange={(next) =>
              updateSheet((prev) => updateSheetEquipmentFromBuild(prev, index, () => next))
            }
          />
          <div style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Equipped</div>
            <CharacterEquippedSlotsPanel
              inventory={sheet.inventory}
              equippedSlots={sheet.equipment}
              characterEquipment={sheet.characterEquipment}
              index={index}
              onEquipItem={equipInventoryItem}
              onUnequipItem={unequipInventoryItem}
            />
          </div>
          <div style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
              {inventoryItems.length > 0 ? `Items (${inventoryItems.length})` : "Items"}
            </div>
            <CharacterInventoryList
              items={inventoryItems}
              onEquipItem={equipInventoryItem}
              onUnequipItem={unequipInventoryItem}
              onRemoveItem={removeInventoryItem}
            />
          </div>
        </div>
      )}

      <JsonCollapsiblePanel
        title="JSON"
        jsonText={expandedSheetJson}
        shellStyle={{
          marginTop: "0.75rem",
          border: "1px solid var(--panel-border)",
          borderRadius: "0.35rem",
          backgroundColor: "var(--surface-0)",
          padding: "0.5rem"
        }}
      />


    </div>
  );
}

export function createDefaultCharacterSheetForTests(): CharacterSheetState {
  return createDefaultCharacterSheetState();
}
