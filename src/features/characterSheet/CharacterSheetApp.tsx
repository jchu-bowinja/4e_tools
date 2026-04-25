import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import type { Armor, Implement, RulesIndex, Weapon } from "../../rules/models";
import { computeSkillSheetRows } from "../../rules/skillCalculator";
import { loadSavedCharacters, type SavedCharacterEntry } from "../builder/storage";
import { RulesRichText } from "../builder/RulesRichText";
import { createDefaultCharacterSheetState } from "./defaultState";
import type { CharacterSheetState, EquipmentSlot, InventoryItem } from "./model";
import { canEquipItem, computeSheetDerivedData, groupCombatPowers, sheetStateFromBuild } from "./selectors";
import { loadCharacterSheetState, saveCharacterSheetState } from "./storage";
import { normalizeTooltipTerm, resolveTooltipText } from "../../data/tooltipGlossary";
import { positionFixedTooltip } from "../../ui/glossaryTooltipPosition";

type SheetTab = "overview" | "inventory";

const tabLabel: Record<SheetTab, string> = {
  overview: "Character",
  inventory: "Inventory"
};

const panelStyle: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  padding: "0.55rem",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
};

const sectionInsetStyle: CSSProperties = {
  backgroundColor: "var(--inset-section-bg, var(--surface-3))",
  border: "1px solid var(--inset-section-border, var(--panel-border))",
  borderRadius: "var(--ui-section-radius, 0.45rem)",
  padding: "0.45rem",
  boxShadow: "inset 0 1px 0 var(--inset-section-highlight, rgba(255, 255, 255, 0.12))"
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

const jsonSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
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

function usageAccentColor(bucket: "atWill" | "encounter" | "daily" | "utility"): string {
  if (bucket === "atWill") return "var(--power-accent-atwill-bar)";
  if (bucket === "encounter") return "var(--power-accent-encounter-bar)";
  if (bucket === "daily") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

function usageAccentCardStyle(bucket: "atWill" | "encounter" | "daily" | "utility"): {
  border: string;
  borderLeft: string;
  backgroundColor: string;
} {
  if (bucket === "atWill") {
    return {
      border: "1px solid var(--power-accent-atwill-border)",
      borderLeft: "6px solid var(--power-accent-atwill-bar)",
      backgroundColor: "var(--power-accent-atwill-bg)"
    };
  }
  if (bucket === "encounter") {
    return {
      border: "1px solid var(--power-accent-encounter-border)",
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)"
    };
  }
  if (bucket === "daily") {
    return {
      border: "1px solid var(--power-accent-daily-border)",
      borderLeft: "6px solid var(--power-accent-daily-bar)",
      backgroundColor: "var(--power-accent-daily-bg)"
    };
  }
  return {
    border: "1px solid var(--panel-border)",
    borderLeft: "6px solid var(--text-secondary)",
    backgroundColor: "var(--surface-1)"
  };
}

function classifyArmorSlots(armor: Armor): EquipmentSlot[] {
  const type = String(armor.armorType || "").toLowerCase();
  return type.includes("shield") ? ["shield"] : ["armor"];
}

function createInventoryId(): string {
  return `inv-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numericInputWidthCh(...values: number[]): string {
  const longest = values.reduce((max, value) => {
    const digits = String(Math.max(0, Math.trunc(value))).length;
    return Math.max(max, digits);
  }, 1);
  // Number inputs include spinner controls, so reserve extra width for arrows.
  return `calc(${Math.max(6, longest + 3)}ch + 4px)`;
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
  bloodied: { background: "#b91c1c", text: "#ffffff" },
  dying: { background: "#9a3412", text: "#ffffff" },
  dead: { background: "#7f1d1d", text: "#ffffff" },
  blinded: { background: "#111827", text: "#f9fafb" },
  dazed: { background: "#92400e", text: "#ffffff" },
  deafened: { background: "#374151", text: "#f9fafb" },
  dominated: { background: "#5b21b6", text: "#ffffff" },
  helpless: { background: "#475569", text: "#f8fafc" },
  immobilized: { background: "#166534", text: "#ffffff" },
  marked: { background: "#a16207", text: "#ffffff" },
  petrified: { background: "#4b5563", text: "#f9fafb" },
  prone: { background: "#9a3412", text: "#ffffff" },
  restrained: { background: "#065f46", text: "#ffffff" },
  slowed: { background: "#155e75", text: "#ffffff" },
  stunned: { background: "#92400e", text: "#ffffff" },
  surprised: { background: "#075985", text: "#ffffff" },
  unconscious: { background: "#1f2937", text: "#ffffff" },
  weakened: { background: "#9d174d", text: "#ffffff" }
};

const CONDITION_EMOJIS: Record<string, string> = {
  bloodied: "🩸",
  dying: "⚠️",
  dead: "☠️",
  blinded: "🙈",
  dazed: "💫",
  deafened: "🔕",
  dominated: "🧠",
  helpless: "🫳",
  immobilized: "🧱",
  marked: "🎯",
  petrified: "🪨",
  prone: "⬇️",
  restrained: "⛓️",
  slowed: "🐢",
  stunned: "😵",
  surprised: "❗",
  unconscious: "💤",
  weakened: "🪫"
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
  const emoji = CONDITION_EMOJIS[normalized] ?? "🏷️";
  return `${emoji} ${name}`;
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

function DeathSaveCheckboxes(props: { value: number; onChange: (next: number) => void }): JSX.Element {
  const value = clamp(props.value, 0, 3);
  return (
    <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", marginTop: "0.1rem" }}>
      {[0, 1, 2].map((idx) => (
        <label key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
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
  | `skill:${string}`;
const CHARACTER_SHEET_GLOSSARY_TOOLTIP_ID = "character-sheet-glossary-tooltip";

export function CharacterSheetApp({ index, tooltipGlossary }: { index: RulesIndex; tooltipGlossary: Record<string, string> }): JSX.Element {
  const [sheet, setSheet] = useState<CharacterSheetState>(() => loadCharacterSheetState());
  const [tab, setTab] = useState<SheetTab>("overview");
  const [draggingPowerId, setDraggingPowerId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [selectedArmorId, setSelectedArmorId] = useState("");
  const [selectedWeaponId, setSelectedWeaponId] = useState("");
  const [selectedImplementId, setSelectedImplementId] = useState("");
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacterEntry[]>(() => loadSavedCharacters());
  const [selectedSavedCharacterId, setSelectedSavedCharacterId] = useState("");
  const [selectedConditionOption, setSelectedConditionOption] = useState("");
  const [customConditionText, setCustomConditionText] = useState("");
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
  const [showGlossaryHoverInfo, setShowGlossaryHoverInfo] = useState(false);
  const [glossaryHoverKey, setGlossaryHoverKey] = useState<GlossaryKey | null>(null);
  const [glossaryHoverPanelPos, setGlossaryHoverPanelPos] = useState<{
    top: number;
    left: number;
    transform?: "translateY(-100%)";
  } | null>(null);
  const raceHoverTimerRef = useRef<number | null>(null);
  const classHoverTimerRef = useRef<number | null>(null);
  const glossaryHoverTimerRef = useRef<number | null>(null);
  const glossaryHoverCloseTimerRef = useRef<number | null>(null);
  const GLOSSARY_HOVER_CLOSE_DELAY_MS = 400;
  const glossaryTermLookupCacheRef = useRef<Map<string, boolean>>(new Map());

  const derived = useMemo(() => computeSheetDerivedData(sheet, index), [sheet, index]);
  const groupedPowers = useMemo(() => groupCombatPowers(sheet, index), [sheet, index]);
  const rulesById = useMemo(() => buildRulesIdLookup(index), [index]);
  const expandedSheetJson = useMemo(() => JSON.stringify(expandJsonIds(sheet, rulesById), null, 2), [sheet, rulesById]);
  const abilityLoreByCode = useMemo(() => {
    const map = new Map<AbilityCode, { name: string; body?: string | null }>();
    for (const entry of index.abilityScores) {
      if (entry.abilityCode) {
        map.set(entry.abilityCode, { name: entry.name, body: entry.body });
      }
    }
    return map;
  }, [index.abilityScores]);
  const skillById = useMemo(() => new Map(index.skills.map((skill) => [skill.id, skill])), [index.skills]);
  const featsById = useMemo(() => new Map(index.feats.map((feat) => [feat.id, feat])), [index.feats]);
  const selectedFeatRows = useMemo(
    () => (sheet.featIds ?? []).map((featId) => featsById.get(featId)).filter((feat): feat is NonNullable<typeof feat> => Boolean(feat)),
    [sheet.featIds, featsById]
  );
  const skillRows = useMemo(
    () => computeSkillSheetRows(index, sheet.level, sheet.abilityScores, new Set(sheet.trainedSkillIds), derived.armorCheckPenalty),
    [index, sheet.level, sheet.abilityScores, sheet.trainedSkillIds, derived.armorCheckPenalty]
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
    let terms: string[] = [];
    if (key.startsWith("ability:")) {
      const code = key.slice("ability:".length) as AbilityCode;
      const lore = abilityLoreByCode.get(code);
      terms = [lore?.name || "", code, "Ability Score"];
    } else if (key.startsWith("skill:")) {
      const skillId = key.slice("skill:".length);
      const skill = skillById.get(skillId);
      terms = [skill?.name || "", "Skill"];
    } else if (key.startsWith("condition:")) {
      const condition = key.slice("condition:".length).trim();
      terms = [condition, "Condition"];
    } else if (key.startsWith("powerKeyword:")) {
      const keyword = key.slice("powerKeyword:".length).trim();
      terms = [keyword, "Keyword"];
    } else if (key.startsWith("powerUsage:")) {
      const usage = key.slice("powerUsage:".length).trim();
      if (usage === "atWill") {
        terms = ["At-Will", "At-Will Power", "At Will"];
      } else if (usage === "encounter") {
        terms = ["Encounter", "Encounter Power"];
      } else if (usage === "daily") {
        terms = ["Daily", "Daily Power"];
      }
    } else {
      const coreTerms: Record<Exclude<GlossaryKey, `condition:${string}` | `powerKeyword:${string}` | `ability:${AbilityCode}` | `skill:${string}`>, string[]> = {
        level: ["Level"],
        hp: ["Hit Points", "HP"],
        tempHp: ["Temporary Hit Points", "Temp HP"],
        surges: ["Healing Surges", "Healing Surge"],
        surgeValue: ["Surge Value", "Healing Surge Value"],
        bloodied: ["Bloodied"],
        dying: ["Dying"],
        dead: ["Dead"],
        speed: ["Speed"],
        initiative: ["Initiative"],
        defenses: ["Defense", "Defenses"],
        ac: ["Armor Class", "AC"],
        fortitude: ["Fortitude"],
        reflex: ["Reflex"],
        will: ["Will"],
        deathSaves: ["Death Saving Throw", "Death Save"],
        skills: ["Skills", "Skill"],
        abilityScores: ["Ability Scores", "Ability Score"]
      };
      terms = coreTerms[key];
    }
    const resolved = resolveTooltipText({ terms: terms.filter(Boolean), glossaryByName: tooltipGlossary, index });
    if (resolved) return <div style={{ whiteSpace: "pre-wrap" }}>{resolved}</div>;
    return <div>No glossary entry found in `generated/glossary_terms.json` or `generated/rules_index.json`.</div>;
  }

  function cancelGlossaryHoverCloseTimer(): void {
    if (glossaryHoverCloseTimerRef.current != null) {
      window.clearTimeout(glossaryHoverCloseTimerRef.current);
      glossaryHoverCloseTimerRef.current = null;
    }
  }

  function hideGlossaryHoverInfoNow(): void {
    cancelGlossaryHoverCloseTimer();
    if (glossaryHoverTimerRef.current != null) {
      window.clearTimeout(glossaryHoverTimerRef.current);
      glossaryHoverTimerRef.current = null;
    }
    setShowGlossaryHoverInfo(false);
    setGlossaryHoverKey(null);
    setGlossaryHoverPanelPos(null);
  }

  function startGlossaryHoverInfoTimer(
    event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>,
    key: GlossaryKey
  ): void {
    cancelGlossaryHoverCloseTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    setGlossaryHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 340, maxHeightVh: 50 }));
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
    }, 1000);
  }

  function leaveGlossaryHoverInfo(): void {
    cancelGlossaryHoverCloseTimer();
    glossaryHoverCloseTimerRef.current = window.setTimeout(() => {
      hideGlossaryHoverInfoNow();
    }, GLOSSARY_HOVER_CLOSE_DELAY_MS);
  }

  function hasGlossaryHoverForTerm(term: string): boolean {
    const normalized = normalizeTooltipTerm(term);
    if (!normalized) return false;
    const cache = glossaryTermLookupCacheRef.current;
    const cached = cache.get(normalized);
    if (cached != null) return cached;
    const found = Boolean(
      resolveTooltipText({
        terms: [term],
        glossaryByName: tooltipGlossary,
        index
      })
    );
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
              onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${term}`)}
              onFocus={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${term}`)}
              onMouseLeave={leaveGlossaryHoverInfo}
              onBlur={leaveGlossaryHoverInfo}
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

  function addInventoryItem(item: InventoryItem): void {
    updateSheet((prev) => ({ ...prev, inventory: [...prev.inventory, item] }));
  }

  function removeInventoryItem(itemId: string): void {
    updateSheet((prev) => {
      const equipment: CharacterSheetState["equipment"] = { ...prev.equipment };
      (Object.keys(equipment) as EquipmentSlot[]).forEach((slot) => {
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

  function setEquipped(slot: EquipmentSlot, itemId: string): void {
    updateSheet((prev) => {
      const item = prev.inventory.find((entry) => entry.id === itemId);
      if (!item || !canEquipItem(item, slot)) return prev;
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          [slot]: itemId
        }
      };
    });
  }

  function unequip(slot: EquipmentSlot): void {
    updateSheet((prev) => {
      const next = { ...prev.equipment };
      delete next[slot];
      return { ...prev, equipment: next };
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

  function getOrderedBucketPowers(bucketPowers: typeof groupedPowers.atWill): typeof groupedPowers.atWill {
    const usedSet = new Set(sheet.powers.expendedPowerIds);
    const manualIndexById = new Map(sheet.powers.manualOrderIds.map((id, idx) => [id, idx]));
    const fallbackIndexById = new Map(bucketPowers.map((power, idx) => [power.id, idx]));
    return [...bucketPowers].sort((a, b) => {
      const aUsed = usedSet.has(a.id);
      const bUsed = usedSet.has(b.id);
      if (aUsed !== bUsed) return aUsed ? 1 : -1;
      const aManual = manualIndexById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bManual = manualIndexById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aManual !== bManual) return aManual - bManual;
      return (fallbackIndexById.get(a.id) ?? 0) - (fallbackIndexById.get(b.id) ?? 0);
    });
  }

  function reorderPowerCardsByDrag(bucketPowers: typeof groupedPowers.atWill, sourcePowerId: string, targetPowerId: string): void {
    if (sourcePowerId === targetPowerId) return;
    const ordered = getOrderedBucketPowers(bucketPowers);
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

  function refreshSavedCharacters(): void {
    setSavedCharacters(loadSavedCharacters());
  }

  function addCondition(name: string): void {
    const normalized = name.trim();
    if (!normalized) return;
    updateSheet((prev) => {
      if (prev.resources.conditions.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        resources: {
          ...prev.resources,
          conditions: [...prev.resources.conditions, normalized]
        }
      };
    });
  }

  function removeCondition(name: string): void {
    updateSheet((prev) => ({
      ...prev,
      resources: {
        ...prev.resources,
        conditions: prev.resources.conditions.filter((existing) => existing !== name)
      }
    }));
  }

  function renderHitPointsPanel(): JSX.Element {
    const isBloodied = sheet.resources.currentHp <= derived.bloodied;
    const isDead = sheet.resources.currentHp <= -derived.bloodied || sheet.resources.deathSaves >= 3;
    const isDying = sheet.resources.currentHp <= 0 && !isDead;

    return (
      <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.5rem", backgroundColor: "var(--surface-0)", display: "grid", gap: "0.35rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.35rem" }}>
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-1)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "hp")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Hit Points
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
              <input
                type="number"
                max={derived.maxHp}
                value={sheet.resources.currentHp}
                onChange={(e) =>
                  updateSheet((prev) => ({
                    ...prev,
                    resources: {
                      ...prev.resources,
                      currentHp: Math.min(Number(e.target.value) || 0, derived.maxHp)
                    }
                  }))
                }
                style={{
                  width: numericInputWidthCh(sheet.resources.currentHp, derived.maxHp),
                  textAlign: "center"
                }}
              />
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>/ {derived.maxHp}</span>
              {(isBloodied || isDying || isDead) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginLeft: "0.15rem" }}>
                  {isBloodied && (
                    <div
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "bloodied")}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={conditionBadgeStyle("bloodied")}
                    >
                      {conditionDisplayLabel("Bloodied")}
                    </div>
                  )}
                  {isDying && (
                    <div
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "dying")}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={conditionBadgeStyle("dying")}
                    >
                      {conditionDisplayLabel("Dying")}
                    </div>
                  )}
                  {isDead && (
                    <div
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "dead")}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={conditionBadgeStyle("dead")}
                    >
                      {conditionDisplayLabel("Dead")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-1)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "surges")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Healing Surges
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input
                type="number"
                min={0}
                max={derived.healingSurgesPerDay}
                value={sheet.resources.surgesRemaining}
                onChange={(e) =>
                  updateSheet((prev) => ({
                    ...prev,
                    resources: {
                      ...prev.resources,
                      surgesRemaining: clamp(Number(e.target.value) || 0, 0, derived.healingSurgesPerDay)
                    }
                  }))
                }
                style={{
                  width: numericInputWidthCh(sheet.resources.surgesRemaining, derived.healingSurgesPerDay),
                  textAlign: "center"
                }}
              />
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>/ {derived.healingSurgesPerDay}</span>
            </div>
          </label>
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-1)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "speed")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Speed
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.88rem", textTransform: "none", letterSpacing: "normal", textAlign: "left" }}>
              {derived.speed}
            </div>
          </label>
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-0)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "tempHp")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Temp HP
            <input
              type="number"
              min={0}
              value={sheet.resources.tempHp}
              onChange={(e) =>
                updateSheet((prev) => ({
                  ...prev,
                  resources: {
                    ...prev.resources,
                    tempHp: Math.max(0, Number(e.target.value) || 0)
                  }
                }))
              }
              style={{ width: numericInputWidthCh(sheet.resources.tempHp), textAlign: "center" }}
            />
          </label>
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-0)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "deathSaves")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Death Saves
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
          <label
            style={{ ...labelStyle, padding: "0.28rem 0.35rem", border: "1px solid var(--panel-border)", borderRadius: "0.3rem", backgroundColor: "var(--surface-0)" }}
            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "initiative")}
            onMouseLeave={leaveGlossaryHoverInfo}
          >
            Initiative
            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.88rem", textTransform: "none", letterSpacing: "normal", textAlign: "left" }}>
              {derived.initiative >= 0 ? `+${derived.initiative}` : derived.initiative}
            </div>
          </label>
        </div>
      </div>
    );
  }

  function renderConditionsPanel(): JSX.Element {
    return (
      <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", backgroundColor: "var(--surface-1)", padding: "0.4rem", display: "grid", gap: "0.25rem", alignContent: "start" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          Conditions
        </div>
        <div style={{ display: "grid", gap: "0.25rem" }}>
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
          {selectedConditionOption === "__custom__" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.2rem" }}>
              <input
                type="text"
                value={customConditionText}
                onChange={(e) => setCustomConditionText(e.target.value)}
                placeholder="Enter custom condition"
                style={{ fontSize: "0.78rem", borderRadius: "0.25rem", border: "1px solid var(--panel-border)", padding: "0.15rem 0.25rem" }}
              />
              <button
                type="button"
                onClick={() => {
                  addCondition(customConditionText);
                  setCustomConditionText("");
                }}
                style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem" }}
              >
                Add
              </button>
            </div>
          )}
          {selectedConditionOption && selectedConditionOption !== "__custom__" && (
            <button
              type="button"
              onClick={() => {
                addCondition(selectedConditionOption);
                setSelectedConditionOption("");
              }}
              style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem", justifySelf: "start" }}
            >
              Add Selected
            </button>
          )}
        </div>
        {sheet.resources.conditions.length === 0 && (
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>None</div>
        )}
        {sheet.resources.conditions.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.25rem" }}>
            {sheet.resources.conditions.map((condition) => (
              <div
                key={condition}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.25rem",
                  alignItems: "center",
                  padding: "0.14rem 0.35rem",
                  borderRadius: "0.25rem",
                  backgroundColor: conditionBadgeStyle(condition).backgroundColor,
                  color: conditionBadgeStyle(condition).color,
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}
              >
                <span
                  onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `condition:${condition}`)}
                  onFocus={(event) => startGlossaryHoverInfoTimer(event, `condition:${condition}`)}
                  onMouseLeave={leaveGlossaryHoverInfo}
                  onBlur={leaveGlossaryHoverInfo}
                  tabIndex={0}
                >
                  {conditionDisplayLabel(condition)}
                </span>
                <button
                  type="button"
                  onClick={() => removeCondition(condition)}
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
                  aria-label={`Remove ${condition}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderDefensesPanel(): JSX.Element {
    return (
      <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.4rem", backgroundColor: "var(--surface-0)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.2rem", columnGap: "0.5rem", fontVariantNumeric: "tabular-nums" }}>
          {[
            { key: "ac" as const, label: "AC", value: derived.defenses.ac },
            { key: "fortitude" as const, label: "Fortitude", value: derived.defenses.fortitude },
            { key: "reflex" as const, label: "Reflex", value: derived.defenses.reflex },
            { key: "will" as const, label: "Will", value: derived.defenses.will }
          ].map((item, idx) => (
            <div key={item.key} style={{ display: "contents" }}>
              <span
                onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, item.key)}
                onMouseLeave={leaveGlossaryHoverInfo}
                style={{
                  padding: "0.16rem 0.35rem",
                  borderRadius: "0.25rem",
                  backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)",
                  color: "var(--text-primary)"
                }}
              >
                {item.label}
              </span>
              <strong
                onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, item.key)}
                onMouseLeave={leaveGlossaryHoverInfo}
                style={{
                  padding: "0.16rem 0.35rem",
                  borderRadius: "0.25rem",
                  textAlign: "right",
                  backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)",
                  color: "var(--text-primary)"
                }}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderStatusPanel(): JSX.Element {
    return (
      <div style={{ border: "1px solid var(--panel-border-strong)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.5rem", display: "grid", gap: "0.45rem" }}>
        <h3 style={sectionTitleStyle}>Status</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.45rem", alignItems: "start" }}>
          {renderHitPointsPanel()}
          {renderDefensesPanel()}
          {renderConditionsPanel()}
        </div>
      </div>
    );
  }

  function startRaceHoverInfoTimer(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!derived.race) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setRaceHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 360, maxHeightVh: 52 }));
    if (raceHoverTimerRef.current != null) {
      window.clearTimeout(raceHoverTimerRef.current);
    }
    raceHoverTimerRef.current = window.setTimeout(() => {
      setShowRaceHoverInfo(true);
      raceHoverTimerRef.current = null;
    }, 1000);
  }

  function stopRaceHoverInfoTimerAndHide(): void {
    if (raceHoverTimerRef.current != null) {
      window.clearTimeout(raceHoverTimerRef.current);
      raceHoverTimerRef.current = null;
    }
    setShowRaceHoverInfo(false);
    setRaceHoverPanelPos(null);
  }

  function startClassHoverInfoTimer(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!derived.cls) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setClassHoverPanelPos(positionFixedTooltip(rect, { panelWidth: 380, maxHeightVh: 52 }));
    if (classHoverTimerRef.current != null) {
      window.clearTimeout(classHoverTimerRef.current);
    }
    classHoverTimerRef.current = window.setTimeout(() => {
      setShowClassHoverInfo(true);
      classHoverTimerRef.current = null;
    }, 1000);
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
        <div style={{ ...panelStyle, display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
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
            <button type="button" onClick={refreshSavedCharacters}>
              Refresh Saved List
            </button>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.5rem", alignItems: "stretch" }}>
            <div style={{ ...sectionInsetStyle, display: "grid", gap: "0.5rem", alignContent: "start" }}>
              <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.4rem", padding: "0.55rem", backgroundColor: "var(--surface-0)", display: "grid", gap: "0.35rem", boxShadow: "inset 0 0 0 1px var(--surface-2)" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                  Character
                </div>
                <div style={{ display: "grid", gap: "0.35rem", gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
                  <div style={{ ...labelStyle, gridColumn: "span 8", gap: "0.12rem" }}>
                    Name
                    <div style={{ border: "1px solid var(--panel-border)", backgroundColor: "var(--surface-0)", borderRadius: "0.32rem", padding: "0.24rem 0.45rem", lineHeight: 1.2, fontWeight: 700, color: "var(--text-primary)" }}>
                      {sheet.name || "-"}
                    </div>
                  </div>
                  <div style={{ ...labelStyle, gridColumn: "span 4", gap: "0.12rem" }}>
                    Race
                    <div
                      onMouseEnter={startRaceHoverInfoTimer}
                      onMouseLeave={stopRaceHoverInfoTimerAndHide}
                      style={{ border: "1px solid var(--panel-border)", backgroundColor: "var(--surface-0)", borderRadius: "0.32rem", padding: "0.24rem 0.45rem", lineHeight: 1.2 }}
                    >
                      {derived.race?.name || "-"}
                    </div>
                  </div>
                  <div style={{ ...labelStyle, gridColumn: "span 9", gap: "0.12rem" }}>
                    Class
                    <div
                      onMouseEnter={startClassHoverInfoTimer}
                      onMouseLeave={stopClassHoverInfoTimerAndHide}
                      style={{ border: "1px solid var(--panel-border)", backgroundColor: "var(--surface-0)", borderRadius: "0.32rem", padding: "0.24rem 0.45rem", lineHeight: 1.2 }}
                    >
                      {derived.cls?.name || "-"}
                    </div>
                  </div>
                  <div style={{ ...labelStyle, gridColumn: "span 3", gap: "0.12rem" }}>
                    Level
                    <div
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "level")}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={{ border: "1px solid var(--panel-border)", backgroundColor: "var(--surface-0)", borderRadius: "0.32rem", padding: "0.24rem 0.45rem", lineHeight: 1.2, textAlign: "left", fontWeight: 800, color: "var(--text-primary)" }}
                    >
                      {sheet.level}
                    </div>
                  </div>
                </div>
              </div>
              <div
                style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.5rem", backgroundColor: "var(--surface-0)" }}
                onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "abilityScores")}
                onMouseLeave={leaveGlossaryHoverInfo}
              >
                <h3 style={sectionTitleStyle}>Ability Scores</h3>
                <div style={{ marginTop: "0.25rem", display: "grid", gap: "0.2rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
                  {(["STR", "CON", "DEX", "INT", "WIS", "CHA"] as const).map((ab, idx) => (
                    <div
                      key={ab}
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `ability:${ab}`)}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        columnGap: "0.5rem",
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-primary)",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          padding: "0.22rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        {ab}
                      </span>
                      <div
                        style={{
                          textAlign: "right",
                          fontSize: "0.82rem",
                          padding: "0.22rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        <strong>{sheet.abilityScores[ab]}</strong>
                        <span style={{ marginLeft: "0.35rem", color: "var(--status-success)", fontWeight: 700 }}>
                          ({derived.abilityMods[ab] >= 0 ? `+${derived.abilityMods[ab]}` : derived.abilityMods[ab]})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ ...sectionInsetStyle, display: "grid", gap: "0.5rem", alignContent: "start" }}>
              <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.5rem", backgroundColor: "var(--surface-0)" }}>
                <h3 style={sectionTitleStyle}>Feats</h3>
                <div style={{ marginTop: "0.25rem", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "0.18rem" }}>
                  {selectedFeatRows.length === 0 ? (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No feats selected.</div>
                  ) : (
                    selectedFeatRows.map((feat, idx) => (
                      <div
                        key={feat.id}
                        style={{
                          fontSize: "0.8rem",
                          lineHeight: 1.2,
                          padding: "0.24rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)",
                          color: "var(--text-primary)"
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{feat.name}</div>
                        {typeof feat.shortDescription === "string" && feat.shortDescription.trim() && (
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
                            {feat.shortDescription}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div style={{ ...sectionInsetStyle, display: "grid", gap: "0.5rem", alignContent: "start" }}>
              <div style={{ border: "1px solid var(--panel-border)", borderRadius: "0.35rem", padding: "0.5rem", backgroundColor: "var(--surface-0)" }}>
                <h3
                  style={sectionTitleStyle}
                  onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, "skills")}
                  onMouseLeave={leaveGlossaryHoverInfo}
                >
                  Skills
                </h3>
                <div style={{ marginTop: "0.25rem", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "0.18rem" }}>
                  {skillRows.map((row, idx) => (
                    <div
                      key={row.skillId}
                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `skill:${row.skillId}`)}
                      onMouseLeave={leaveGlossaryHoverInfo}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        columnGap: "0.5rem",
                        alignItems: "center",
                        fontSize: "0.8rem",
                        lineHeight: 1.2,
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-primary)",
                          padding: "0.2rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        {row.name}
                        {row.trained ? <strong style={{ color: "var(--status-success)" }}> (T)</strong> : null}
                      </span>
                      <strong
                        style={{
                          textAlign: "right",
                          padding: "0.2rem 0.35rem",
                          borderRadius: "0.25rem",
                          backgroundColor: idx % 2 === 0 ? "var(--table-stripe-even)" : "var(--table-stripe-odd)"
                        }}
                      >
                        {row.modifier >= 0 ? `+${row.modifier}` : row.modifier}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ ...sectionInsetStyle, gridColumn: "1 / -1" }}>
            {renderStatusPanel()}
          </div>
          {(["atWill", "encounter", "daily"] as const).map((bucket) => (
            <div key={bucket} style={{ ...sectionInsetStyle, gridColumn: "1 / -1" }}>
              <div style={panelStyle}>
                <div
                  onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `powerUsage:${bucket}`)}
                  onMouseLeave={leaveGlossaryHoverInfo}
                  style={{
                    fontWeight: 700,
                    marginBottom: "0.35rem",
                    borderLeft: `5px solid ${usageAccentColor(bucket)}`,
                    paddingLeft: "0.45rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-primary)"
                  }}
                >
                  {bucket === "atWill" ? "At-Will" : bucket === "encounter" ? "Encounter" : "Daily"}
                </div>
                {(() => {
                  const orderedBucketPowers = getOrderedBucketPowers(groupedPowers[bucket]);
                  const usedSet = new Set(sheet.powers.expendedPowerIds);
                  return orderedBucketPowers.length === 0 ? (
                  <div style={{ color: "var(--text-muted)" }}>No cards selected.</div>
                ) : (
                  <div style={{ display: "grid", gap: "0.4rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "stretch" }}>
                    {orderedBucketPowers.map((power) => {
                    const accent = usageAccentCardStyle(bucket);
                    const expended = usedSet.has(power.id);
                    const canExpend = bucket === "encounter" || bucket === "daily";
                    const raw = (power.raw || {}) as Record<string, unknown>;
                    const specific = (raw.specific as Record<string, unknown> | undefined) || {};
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
                    const flavor = typeof raw.flavor === "string" ? raw.flavor : "";
                    const body = typeof raw.body === "string" ? raw.body : "";
                      return (
                      <div
                        key={power.id}
                        style={{
                          border: accent.border,
                          borderLeft: accent.borderLeft,
                          borderRadius: "8px",
                          padding: "0.55rem 0.65rem",
                          backgroundColor: accent.backgroundColor,
                          boxShadow: `inset 0 0 0 1px ${usageAccentColor(bucket)}33`,
                          opacity: expended ? 0.58 : 1,
                          filter: expended ? "grayscale(0.55) saturate(0.65) brightness(0.88) contrast(0.82)" : "none",
                          height: "100%",
                          boxSizing: "border-box",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                          cursor: "grab"
                        }}
                        draggable
                        onDragStart={() => setDraggingPowerId(power.id)}
                        onDragEnd={() => setDraggingPowerId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggingPowerId) return;
                          reorderPowerCardsByDrag(groupedPowers[bucket], draggingPowerId, power.id);
                          setDraggingPowerId(null);
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ textDecoration: expended ? "line-through" : "none" }}>{power.name}</strong>
                          <span
                            onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `powerUsage:${bucket}`)}
                            onMouseLeave={leaveGlossaryHoverInfo}
                            style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
                          >
                            Lv {power.level ?? 0} • {power.usage || "-"}
                          </span>
                        </div>
                        {expended ? (
                          <div
                            style={{
                              marginTop: "0.28rem",
                              alignSelf: "flex-start",
                              padding: "0.12rem 0.45rem",
                              borderRadius: "999px",
                              backgroundColor: "var(--status-danger)",
                              color: "#ffffff",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase"
                            }}
                          >
                            Used
                          </div>
                        ) : null}
                        {display ? <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>{display}</div> : null}
                        {keywordTokens.length > 0 ? (
                          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                            <strong>Keywords:</strong>{" "}
                            {keywordTokens.map((keyword, idx) => (
                              <span key={`${power.id}-keyword-${keyword}`}>
                                {(() => {
                                  const isParalysisKeyword = keyword.trim().toLowerCase() === "paralysis";
                                  if (isParalysisKeyword) {
                                    return (
                                      <span
                                        style={{
                                          color: "var(--text-primary)"
                                        }}
                                      >
                                        {keyword}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span
                                      onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${keyword}`)}
                                      onFocus={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${keyword}`)}
                                      onMouseLeave={leaveGlossaryHoverInfo}
                                      onBlur={leaveGlossaryHoverInfo}
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
                                })()}
                                {idx < keywordTokens.length - 1 ? <span> </span> : null}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {(actionType || attackType || target || trigger || requirement) && (
                          <div style={{ marginTop: "0.3rem", fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                            {actionType ? (
                              <div>
                                <strong>Action:</strong>{" "}
                                {hasGlossaryHoverForTerm(actionType) ? (
                                  <span
                                    onMouseEnter={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${actionType}`)}
                                    onFocus={(event) => startGlossaryHoverInfoTimer(event, `powerKeyword:${actionType}`)}
                                    onMouseLeave={leaveGlossaryHoverInfo}
                                    onBlur={leaveGlossaryHoverInfo}
                                    tabIndex={0}
                                    style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: "2px" }}
                                  >
                                    {actionType}
                                  </span>
                                ) : (
                                  renderPowerTextWithGlossaryHovers(actionType, `${power.id}-action`)
                                )}
                              </div>
                            ) : null}
                            {attackType ? <div><strong>Range/Area:</strong> {renderPowerTextWithGlossaryHovers(attackType, `${power.id}-attack-type`)}</div> : null}
                            {target ? <div><strong>Target:</strong> {renderPowerTextWithGlossaryHovers(target, `${power.id}-target`)}</div> : null}
                            {trigger ? <div><strong>Trigger:</strong> {renderPowerTextWithGlossaryHovers(trigger, `${power.id}-trigger`)}</div> : null}
                            {requirement ? <div><strong>Requirement:</strong> {renderPowerTextWithGlossaryHovers(requirement, `${power.id}-requirement`)}</div> : null}
                          </div>
                        )}
                        {(hit || miss || effect || special) && (
                          <div style={{ marginTop: "0.3rem", fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                            {hit ? <div><strong>Hit:</strong> {renderPowerTextWithGlossaryHovers(hit, `${power.id}-hit`)}</div> : null}
                            {miss ? <div><strong>Miss:</strong> {renderPowerTextWithGlossaryHovers(miss, `${power.id}-miss`)}</div> : null}
                            {effect ? <div><strong>Effect:</strong> {renderPowerTextWithGlossaryHovers(effect, `${power.id}-effect`)}</div> : null}
                            {special ? <div><strong>Special:</strong> {renderPowerTextWithGlossaryHovers(special, `${power.id}-special`)}</div> : null}
                          </div>
                        )}
                        {body ? (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.8rem", color: "var(--text-primary)" }}>
                            <RulesRichText
                              text={body}
                              paragraphStyle={{ fontSize: "0.8rem", color: "var(--text-primary)", margin: "0 0 0.35rem 0" }}
                              listItemStyle={{ fontSize: "0.8rem", color: "var(--text-primary)" }}
                            />
                          </div>
                        ) : null}
                        <div
                          style={{
                            marginTop: "auto",
                            paddingTop: "0.35rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            gap: "0.5rem"
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {flavor ? (
                              <p style={{ margin: 0, fontStyle: "italic", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                {flavor}
                              </p>
                            ) : null}
                          </div>
                          {canExpend ? (
                            <button type="button" onClick={() => togglePowerExpended(power.id)}>
                              {expended ? "Mark Ready" : "Mark Used"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                );
                })()}
              </div>
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
          {showGlossaryHoverInfo && glossaryHoverKey && glossaryHoverPanelPos && (
            <div
              id={CHARACTER_SHEET_GLOSSARY_TOOLTIP_ID}
              role="tooltip"
              onMouseEnter={cancelGlossaryHoverCloseTimer}
              onMouseLeave={leaveGlossaryHoverInfo}
              style={{
                position: "fixed",
                top: glossaryHoverPanelPos.top,
                left: glossaryHoverPanelPos.left,
                transform: glossaryHoverPanelPos.transform ?? "none",
                width: "340px",
                maxHeight: "50vh",
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
                boxShadow: "0 8px 24px rgba(45, 34, 16, 0.2)",
                display: "grid",
                gap: "0.2rem"
              }}
            >
              {glossaryContent(glossaryHoverKey)}
            </div>
          )}
        </div>
      )}

      {tab === "inventory" && (
        <div style={{ display: "grid", gap: "0.55rem" }}>
          <div style={{ ...panelStyle, display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <select value={selectedArmorId} onChange={(e) => setSelectedArmorId(e.target.value)}>
              <option value="">Add armor/shield from rules...</option>
              {index.armors.map((armor) => (
                <option key={armor.id} value={armor.id}>
                  {armor.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const armor = index.armors.find((a) => a.id === selectedArmorId);
                if (!armor) return;
                addInventoryItem({
                  id: createInventoryId(),
                  name: armor.name,
                  kind: "armor",
                  quantity: 1,
                  sourceId: armor.id,
                  slotHints: classifyArmorSlots(armor)
                });
                setSelectedArmorId("");
              }}
            >
              Add Armor
            </button>

            <select value={selectedWeaponId} onChange={(e) => setSelectedWeaponId(e.target.value)}>
              <option value="">Add weapon from rules...</option>
              {index.weapons?.map((weapon: Weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const weapon = index.weapons?.find((w) => w.id === selectedWeaponId);
                if (!weapon) return;
                addInventoryItem({
                  id: createInventoryId(),
                  name: weapon.name,
                  kind: "weapon",
                  quantity: 1,
                  sourceId: weapon.id,
                  slotHints: ["mainHand", "offHand"]
                });
                setSelectedWeaponId("");
              }}
            >
              Add Weapon
            </button>

            <select value={selectedImplementId} onChange={(e) => setSelectedImplementId(e.target.value)}>
              <option value="">Add implement from rules...</option>
              {index.implements?.map((implement: Implement) => (
                <option key={implement.id} value={implement.id}>
                  {implement.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const implement = index.implements?.find((imp) => imp.id === selectedImplementId);
                if (!implement) return;
                addInventoryItem({
                  id: createInventoryId(),
                  name: implement.name,
                  kind: "implement",
                  quantity: 1,
                  sourceId: implement.id,
                  slotHints: ["implement", "mainHand", "offHand"]
                });
                setSelectedImplementId("");
              }}
            >
              Add Implement
            </button>

            <input value={newItemName} placeholder="Custom gear name" onChange={(e) => setNewItemName(e.target.value)} />
            <button
              type="button"
              onClick={() => {
                const trimmed = newItemName.trim();
                if (!trimmed) return;
                addInventoryItem({
                  id: createInventoryId(),
                  name: trimmed,
                  kind: "gear",
                  quantity: 1,
                  slotHints: []
                });
                setNewItemName("");
              }}
            >
              Add Gear
            </button>
          </div>

          <div style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Equipment</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
              {(["armor", "shield", "mainHand", "offHand", "implement"] as const).map((slot) => {
                const equippedId = sheet.equipment[slot];
                return (
                  <div key={slot}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{slot}</div>
                    <select value={equippedId || ""} onChange={(e) => (e.target.value ? setEquipped(slot, e.target.value) : unequip(slot))}>
                      <option value="">Unequipped</option>
                      {sheet.inventory
                        .filter((item) => canEquipItem(item, slot))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Inventory</div>
            {sheet.inventory.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>No items yet.</div>
            ) : (
              <div style={{ display: "grid", gap: "0.25rem" }}>
                {sheet.inventory.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div>
                      {item.name} ({item.kind}) {item.quantity > 1 ? `x${item.quantity}` : ""}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button type="button" onClick={() => removeInventoryItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "0.75rem", border: "1px solid var(--panel-border)", borderRadius: "0.35rem", backgroundColor: "var(--surface-0)", padding: "0.5rem" }}>
        <details>
          <summary style={jsonSummaryStyle}>
            JSON
          </summary>
          <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                if (!navigator.clipboard?.writeText) {
                  alert("Clipboard API unavailable in this browser.");
                  return;
                }
                void navigator.clipboard.writeText(expandedSheetJson);
              }}
            >
              Copy Contents
            </button>
          </div>
          <textarea
            value={expandedSheetJson}
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
  );
}

export function createDefaultCharacterSheetForTests(): CharacterSheetState {
  return createDefaultCharacterSheetState();
}
