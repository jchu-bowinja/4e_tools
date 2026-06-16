import {
  consumableEntries,
  consumableQuantity,
  addConsumableQuantity,
  setConsumableEntries,
  setConsumableQuantity,
  type CharacterConsumableEntry
} from "./consumablesModel";
import type { ClassFeatureChoiceGroup } from "./classFeatureChoices";
import {
  formatClassPowerChoiceSelection,
  parseClassPowerChoiceSelection
} from "./classFeatureChoices";
import type { ClassPowerSlotDef } from "./classPowerSlots";
import { orderedPowerIdsFromSlots } from "./classPowerSlots";
import { collectCharacterClassFeatureIds } from "./characterClassFeatures";
import type { CharacterBuild, RulesIndex } from "./models";
import { resolveBaseAugmentablePowerId } from "./psionicPowerAugments";

/** Default PHB spellbook power picks per daily/utility milestone (overlay can override). */
export const WIZARD_SPELLBOOK_POWER_PICKS_PER_POOL = 2;

/** Default PHB free ritual slots by character level (overlay can override per feature). */
export const WIZARD_SPELLBOOK_RITUAL_MILESTONES = [
  { level: 1, pickCount: 3 },
  { level: 5, pickCount: 2 },
  { level: 11, pickCount: 2 },
  { level: 15, pickCount: 2 },
  { level: 21, pickCount: 2 },
  { level: 25, pickCount: 2 }
] as const;

export type WizardSpellbookRitualMilestone = { level: number; pickCount: number };

/** Wizard spellbook feature id, resolved from the ETL `spellbookKind` flag. */
function wizardSpellbookFeatureId(index: RulesIndex): string | undefined {
  return index.classFeatures?.find((f) => f.spellbookKind === "wizard")?.id;
}

function wizardSpellbookPowerPicksPerPool(index: RulesIndex): number {
  const feature = index.classFeatures?.find((f) => f.spellbookKind === "wizard");
  return feature?.spellbookPowerPicksPerPool ?? WIZARD_SPELLBOOK_POWER_PICKS_PER_POOL;
}

function wizardSpellbookRitualMilestones(index?: RulesIndex): WizardSpellbookRitualMilestone[] {
  const feature = index?.classFeatures?.find((f) => f.spellbookKind === "wizard");
  return feature?.spellbookRitualMilestones ?? [...WIZARD_SPELLBOOK_RITUAL_MILESTONES];
}

export function wizardSpellbookRitualSelectionKey(milestoneLevel: number): string {
  return `wizardSpellbookRitual:${milestoneLevel}`;
}

export function wizardSpellbookPowerSelectionKey(poolIndex: number, featureId: string): string {
  return `classPower:${featureId}:${poolIndex}`;
}

export function parseWizardSpellbookPowerSelection(raw: string | undefined): string[] {
  return parseClassPowerChoiceSelection(raw);
}

function spellbookSelectRows(index: RulesIndex): SpellbookSelectRow[] {
  const rows = spellbookSelectRowsFromIndex(index);
  return rows.length > 0 ? rows : FALLBACK_SPELLBOOK_ROWS;
}

/** Map a class daily/utility slot to the spellbook compendium pool index, if any. */
export function spellbookPoolIndexForClassSlotDef(
  def: ClassPowerSlotDef,
  index: RulesIndex
): number | undefined {
  if (def.bucket !== "daily" && def.bucket !== "utility") return undefined;
  for (const row of spellbookSelectRows(index)) {
    if (row.minLevel !== def.gainLevel) continue;
    const lower = row.slotLabel.toLowerCase();
    if (def.bucket === "daily" && lower.includes("daily")) return row.poolIndex;
    if (def.bucket === "utility" && lower.includes("utility")) return row.poolIndex;
  }
  return undefined;
}

export function findWizardSpellbookPowerGroup(
  groups: ClassFeatureChoiceGroup[],
  poolIndex: number
): ClassFeatureChoiceGroup | undefined {
  return groups.find((g) => isWizardSpellbookPowerGroup(g) && g.powerPoolIndex === poolIndex);
}

/** Power ids chosen in other spellbook pool slots (for dropdown exclusion). */
export function wizardSpellbookPowerIdsUsedOutsidePoolPick(
  index: RulesIndex,
  classSelections: Record<string, string> | undefined,
  poolIndex: number,
  pickIndex: number
): Set<string> {
  const used = new Set<string>();
  const featureId = wizardSpellbookFeatureId(index);
  if (!featureId) return used;
  for (const row of spellbookSelectRows(index)) {
    const idx = row.poolIndex;
    const picks = parseWizardSpellbookPowerSelection(
      classSelections?.[wizardSpellbookPowerSelectionKey(idx, featureId)]
    );
    picks.forEach((id, i) => {
      if (!id) return;
      if (idx === poolIndex && i === pickIndex) return;
      used.add(id);
    });
  }
  return used;
}

/** Sync first spellbook power pick from class power slots when only the slot was set. */
export function syncWizardSpellbookPowerSelectionsFromClassSlots(
  classSelections: Record<string, string> | undefined,
  classPowerSlots: Record<string, string> | undefined,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[],
  groups: ClassFeatureChoiceGroup[],
  build: CharacterBuild
): Record<string, string> | undefined {
  return syncClassSpellbookPowerSelectionsFromClassSlots(
    classSelections,
    classPowerSlots,
    index,
    slotDefs,
    groups,
    build
  );
}

export type SpellbookSlotBinding =
  | { kind: "wizard"; poolIndex: number; group: ClassFeatureChoiceGroup }
  | { kind: "mage-combined"; group: ClassFeatureChoiceGroup }
  | { kind: "mage-split"; groups: ClassFeatureChoiceGroup[] };

export function isWizardSpellbookPowerGroup(group: ClassFeatureChoiceGroup): boolean {
  return group.kind === "power" && group.spellbookKind === "wizard" && group.powerPoolIndex != null;
}

export function isMageSpellbookPowerGroup(group: ClassFeatureChoiceGroup): boolean {
  return group.kind === "power" && group.spellbookKind === "mage" && group.powerPoolIndex != null;
}

/** Power pools chosen via spellbook rules on the Powers tab (not the class-feature power section). */
export function isClassSpellbookPowerGroup(group: ClassFeatureChoiceGroup): boolean {
  return isWizardSpellbookPowerGroup(group) || isMageSpellbookPowerGroup(group);
}

function characterHasSpellbookKind(
  index: RulesIndex,
  build: CharacterBuild,
  kind: "wizard" | "mage"
): boolean {
  const byId = new Map((index.classFeatures ?? []).map((f) => [f.id, f]));
  return collectCharacterClassFeatureIds(index, build).some(
    (fid) => byId.get(fid)?.spellbookKind === kind
  );
}

export function characterHasWizardSpellbook(index: RulesIndex, build: CharacterBuild): boolean {
  return characterHasSpellbookKind(index, build, "wizard");
}

export function characterHasMageSpellbook(index: RulesIndex, build: CharacterBuild): boolean {
  return characterHasSpellbookKind(index, build, "mage");
}

export function characterHasClassSpellbook(index: RulesIndex, build: CharacterBuild): boolean {
  return characterHasWizardSpellbook(index, build) || characterHasMageSpellbook(index, build);
}

export function mageSpellbookParentNameForSlot(def: ClassPowerSlotDef): string | undefined {
  if (def.bucket === "encounter") return `Level ${def.gainLevel} Mage Encounter Powers`;
  if (def.bucket === "daily") return `Level ${def.gainLevel} Mage Daily Powers`;
  if (def.bucket === "utility") return `Level ${def.gainLevel} Mage Utility Powers`;
  return undefined;
}

export function mageSpellbookGroupsForSlot(
  def: ClassPowerSlotDef,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  const parent = mageSpellbookParentNameForSlot(def);
  if (!parent) return [];
  return groups
    .filter((g) => isMageSpellbookPowerGroup(g) && g.parentFeatureName === parent)
    .sort((a, b) => (a.powerPoolIndex ?? 0) - (b.powerPoolIndex ?? 0));
}

export function resolveSpellbookSlotBinding(
  def: ClassPowerSlotDef,
  groups: ClassFeatureChoiceGroup[],
  index: RulesIndex,
  build: CharacterBuild
): SpellbookSlotBinding | undefined {
  if (characterHasWizardSpellbook(index, build)) {
    const poolIndex = spellbookPoolIndexForClassSlotDef(def, index);
    if (poolIndex == null) return undefined;
    const group = findWizardSpellbookPowerGroup(groups, poolIndex);
    if (!group) return undefined;
    return { kind: "wizard", poolIndex, group };
  }
  if (characterHasMageSpellbook(index, build)) {
    const mageGroups = mageSpellbookGroupsForSlot(def, groups);
    if (mageGroups.length === 0) return undefined;
    if (mageGroups.length === 1 && mageGroups[0]!.pickCount >= 2) {
      return { kind: "mage-combined", group: mageGroups[0]! };
    }
    if (mageGroups.length >= 2) {
      return { kind: "mage-split", groups: mageGroups };
    }
  }
  return undefined;
}

export function spellbookSelectionKeyForBinding(binding: SpellbookSlotBinding): string {
  if (binding.kind === "wizard") return binding.group.key;
  if (binding.kind === "mage-combined") return binding.group.key;
  return binding.groups[0]?.key ?? "";
}

export function spellbookPicksForBinding(
  binding: SpellbookSlotBinding,
  classSelections: Record<string, string> | undefined
): string[] {
  if (binding.kind === "mage-split") {
    return binding.groups.map((g) => parseWizardSpellbookPowerSelection(classSelections?.[g.key])[0] || "");
  }
  const key = spellbookSelectionKeyForBinding(binding);
  const picks = [...parseWizardSpellbookPowerSelection(classSelections?.[key])];
  while (picks.length < 2) picks.push("");
  return picks;
}

export function syncClassSpellbookPowerSelectionsFromClassSlots(
  classSelections: Record<string, string> | undefined,
  classPowerSlots: Record<string, string> | undefined,
  index: RulesIndex,
  slotDefs: ClassPowerSlotDef[],
  groups: ClassFeatureChoiceGroup[],
  build: CharacterBuild
): Record<string, string> | undefined {
  if (!classPowerSlots || !characterHasClassSpellbook(index, build)) return classSelections;
  let next = classSelections ? { ...classSelections } : {};
  let changed = false;
  const buildForBinding = { ...build, classSelections: next };
  for (const def of slotDefs) {
    const slotPower = classPowerSlots[def.key]?.trim();
    if (!slotPower) continue;
    const binding = resolveSpellbookSlotBinding(def, groups, index, buildForBinding);
    if (!binding) continue;

    if (binding.kind === "mage-split") {
      const first = binding.groups[0];
      if (!first) continue;
      const current = parseWizardSpellbookPowerSelection(next[first.key])[0] || "";
      if (current === slotPower) continue;
      next[first.key] = slotPower;
      changed = true;
      continue;
    }

    const key = binding.group.key;
    const picks = parseWizardSpellbookPowerSelection(next[key]);
    if (picks[0] === slotPower) continue;
    const updated = [...picks];
    updated[0] = slotPower;
    next[key] = formatClassPowerChoiceSelection(updated);
    changed = true;
  }
  return changed ? next : classSelections;
}

/** Power ids chosen in other spellbook slots (for dropdown exclusion). */
export function classSpellbookPowerIdsUsedOutsidePick(
  index: RulesIndex,
  classSelections: Record<string, string> | undefined,
  groups: ClassFeatureChoiceGroup[],
  build: CharacterBuild,
  binding: SpellbookSlotBinding,
  pickIndex: number
): Set<string> {
  const used = new Set<string>();
  for (const g of groups) {
    if (!isClassSpellbookPowerGroup(g)) continue;
    const picks = parseWizardSpellbookPowerSelection(classSelections?.[g.key]);
    picks.forEach((id, i) => {
      if (!id) return;
      if (binding.kind === "wizard" && g.key === binding.group.key) {
        if (i === pickIndex) return;
      } else if (binding.kind === "mage-combined" && g.key === binding.group.key) {
        if (i === pickIndex) return;
      } else if (binding.kind === "mage-split") {
        const poolIdx = binding.groups.findIndex((x) => x.key === g.key);
        if (poolIdx === pickIndex) return;
      }
      used.add(id);
    });
  }
  const featureId = wizardSpellbookFeatureId(index);
  if (featureId && characterHasWizardSpellbook(index, build)) {
    for (const row of spellbookSelectRows(index)) {
      const idx = row.poolIndex;
      if (binding.kind === "wizard" && idx === binding.poolIndex) continue;
      const picks = parseWizardSpellbookPowerSelection(
        classSelections?.[wizardSpellbookPowerSelectionKey(idx, featureId)]
      );
      picks.forEach((id) => {
        if (id) used.add(id);
      });
    }
  }
  return used;
}

export function applyClassSpellbookSlotPick(
  index: RulesIndex,
  build: CharacterBuild,
  slotDefs: ClassPowerSlotDef[],
  binding: SpellbookSlotBinding,
  pickIndex: number,
  powerId: string,
  classSlotKey: string
): CharacterBuild {
  const normalizedId = powerId ? resolveBaseAugmentablePowerId(index, powerId) : "";
  let nextSelections = { ...(build.classSelections || {}) };

  if (binding.kind === "mage-split") {
    const group = binding.groups[pickIndex];
    if (!group) return build;
    if (normalizedId) nextSelections[group.key] = normalizedId;
    else delete nextSelections[group.key];
  } else {
    const key = spellbookSelectionKeyForBinding(binding);
    const picks = [...parseWizardSpellbookPowerSelection(build.classSelections?.[key])];
    while (picks.length < 2) picks.push("");
    picks[pickIndex] = normalizedId;
    const stored = formatClassPowerChoiceSelection(picks.filter(Boolean));
    if (stored) nextSelections[key] = stored;
    else delete nextSelections[key];
  }

  let nextBuild: CharacterBuild = {
    ...build,
    classSelections: Object.keys(nextSelections).length ? nextSelections : undefined
  };

  const syncsToSlot =
    binding.kind === "mage-split" ? pickIndex === 0 : pickIndex === 0;
  if (syncsToSlot) {
    const prevId = nextBuild.classPowerSlots?.[classSlotKey];
    const nextSlots: Record<string, string> = { ...(nextBuild.classPowerSlots || {}) };
    if (normalizedId) nextSlots[classSlotKey] = normalizedId;
    else delete nextSlots[classSlotKey];
    const trimmed = Object.keys(nextSlots).length ? nextSlots : undefined;
    nextBuild = {
      ...nextBuild,
      classPowerSlots: trimmed,
      powerIds: orderedPowerIdsFromSlots(slotDefs, trimmed)
    };
    if (prevId && prevId !== normalizedId && nextBuild.powerSelections?.[prevId]) {
      const ps = { ...nextBuild.powerSelections };
      delete ps[prevId];
      nextBuild = { ...nextBuild, powerSelections: Object.keys(ps).length ? ps : undefined };
    }
  }
  return nextBuild;
}

type SpellbookSelectRow = {
  poolIndex: number;
  minLevel: number;
  slotLabel: string;
};

function classFeatureSelectRules(
  feature: { raw?: { rules?: Record<string, unknown> } } | undefined
): Array<{ attrs?: Record<string, string> }> {
  const rules = feature?.raw?.rules as Record<string, unknown> | undefined;
  const select = rules?.select;
  return Array.isArray(select) ? (select as Array<{ attrs?: Record<string, string> }>) : [];
}

/** Compendium `rules.select` rows for Spellbook (daily / utility pools in order). */
export function spellbookSelectRowsFromIndex(index: RulesIndex): SpellbookSelectRow[] {
  const cf = index.classFeatures?.find((f) => f.spellbookKind === "wizard");
  const rows: SpellbookSelectRow[] = [];
  let poolIndex = 0;
  for (const item of classFeatureSelectRules(cf)) {
    const attrs = item.attrs ?? {};
    if (attrs.type !== "Power") continue;
    const cat = String(attrs.Category ?? attrs.category ?? "").trim();
    if (!cat.toLowerCase().startsWith("$$class")) continue;
    const minLevel = Math.max(1, Number.parseInt(String(attrs.Level ?? "1"), 10) || 1);
    const slotLabel = String(attrs.spellbook ?? attrs.Spellbook ?? "").trim() || `Pool ${poolIndex + 1}`;
    rows.push({ poolIndex, minLevel, slotLabel });
    poolIndex += 1;
  }
  return rows;
}

const FALLBACK_SPELLBOOK_ROWS: SpellbookSelectRow[] = [
  { poolIndex: 0, minLevel: 1, slotLabel: "Power Daily 1" },
  { poolIndex: 1, minLevel: 5, slotLabel: "Power Daily 5" },
  { poolIndex: 2, minLevel: 9, slotLabel: "Power Daily 9" },
  { poolIndex: 3, minLevel: 15, slotLabel: "Power Daily 15" },
  { poolIndex: 4, minLevel: 19, slotLabel: "Power Daily 19" },
  { poolIndex: 5, minLevel: 25, slotLabel: "Power Daily 25" },
  { poolIndex: 6, minLevel: 29, slotLabel: "Power Daily 29" },
  { poolIndex: 7, minLevel: 2, slotLabel: "Power Utility 2" },
  { poolIndex: 8, minLevel: 6, slotLabel: "Power Utility 6" },
  { poolIndex: 9, minLevel: 10, slotLabel: "Power Utility 10" },
  { poolIndex: 10, minLevel: 16, slotLabel: "Power Utility 16" },
  { poolIndex: 11, minLevel: 22, slotLabel: "Power Utility 22" }
];

function spellbookRowByPoolIndex(index: RulesIndex, poolIndex: number | undefined): SpellbookSelectRow | undefined {
  const rows = spellbookSelectRowsFromIndex(index);
  const list = rows.length > 0 ? rows : FALLBACK_SPELLBOOK_ROWS;
  if (poolIndex == null) return undefined;
  return list.find((r) => r.poolIndex === poolIndex);
}

/** Apply PHB spellbook pick count (2) and level gates to ETL choice groups. */
export function applyWizardSpellbookPowerGroupRules(
  index: RulesIndex,
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  return groups.map((g) => {
    if (!isWizardSpellbookPowerGroup(g)) return g;
    const row = spellbookRowByPoolIndex(index, g.powerPoolIndex);
    return {
      ...g,
      pickCount: wizardSpellbookPowerPicksPerPool(index),
      minLevel: row?.minLevel ?? g.minLevel,
      spellbookSlotLabel: row?.slotLabel
    };
  });
}

/** Split mage spellbook pools pick one each; a single pool keeps the ETL pick count (usually 2). */
export function applyMageSpellbookPowerGroupRules(
  groups: ClassFeatureChoiceGroup[]
): ClassFeatureChoiceGroup[] {
  const poolCountByParent = new Map<string, number>();
  for (const g of groups) {
    if (!isMageSpellbookPowerGroup(g)) continue;
    poolCountByParent.set(
      g.parentFeatureName,
      (poolCountByParent.get(g.parentFeatureName) ?? 0) + 1
    );
  }
  return groups.map((g) => {
    if (!isMageSpellbookPowerGroup(g)) return g;
    const poolCount = poolCountByParent.get(g.parentFeatureName) ?? 1;
    if (poolCount >= 2) return { ...g, pickCount: 1 };
    return g;
  });
}

export function wizardSpellbookPowerChoiceLabel(
  group: ClassFeatureChoiceGroup,
  index: RulesIndex
): string {
  const slot = (group as ClassFeatureChoiceGroup & { spellbookSlotLabel?: string }).spellbookSlotLabel;
  const label =
    slot ?? spellbookRowByPoolIndex(index, group.powerPoolIndex)?.slotLabel ?? group.parentFeatureName;
  const picks = group.pickCount;
  return `Spellbook — ${label} (${picks} pick${picks === 1 ? "" : "s"})`;
}

export function visibleWizardSpellbookRitualMilestones(
  characterLevel: number,
  index?: RulesIndex
): WizardSpellbookRitualMilestone[] {
  return wizardSpellbookRitualMilestones(index).filter((m) => characterLevel >= m.level);
}

export function parseWizardSpellbookRitualSelection(raw: string | undefined): string[] {
  return parseClassPowerChoiceSelection(raw);
}

export function collectWizardSpellbookRitualIds(
  classSelections: Record<string, string> | undefined,
  characterLevel: number
): string[] {
  const ids: string[] = [];
  for (const m of visibleWizardSpellbookRitualMilestones(characterLevel)) {
    ids.push(...parseWizardSpellbookRitualSelection(classSelections?.[wizardSpellbookRitualSelectionKey(m.level)]));
  }
  return ids;
}

/** Ritual ids already chosen in other spellbook free-ritual slots (any milestone). */
export function wizardSpellbookRitualIdsUsedOutsideSlot(
  classSelections: Record<string, string> | undefined,
  characterLevel: number,
  milestoneLevel: number,
  slotIndex: number
): Set<string> {
  const used = new Set<string>();
  for (const m of visibleWizardSpellbookRitualMilestones(characterLevel)) {
    const picks = parseWizardSpellbookRitualSelection(
      classSelections?.[wizardSpellbookRitualSelectionKey(m.level)]
    );
    picks.forEach((id, i) => {
      if (!id) return;
      if (m.level === milestoneLevel && i === slotIndex) return;
      used.add(id);
    });
  }
  return used;
}

/** Minimum ritual-book quantity per id while it remains a spellbook free-ritual pick (always 1). */
export function minRitualBookQuantityForWizardFreeRituals(
  index: RulesIndex,
  build: CharacterBuild
): Record<string, number> {
  if (!characterHasWizardSpellbook(index, build)) return {};
  const out: Record<string, number> = {};
  for (const id of new Set(
    collectWizardSpellbookRitualIds(build.classSelections, build.level).filter(Boolean)
  )) {
    out[id] = 1;
  }
  return out;
}

/** Apply spellbook free-ritual minimum quantities to `build.rituals` after any inventory edit. */
export function applyWizardFreeRitualBookMinimumsToBuild(
  index: RulesIndex,
  build: CharacterBuild
): CharacterBuild {
  const min = minRitualBookQuantityForWizardFreeRituals(index, build);
  if (Object.keys(min).length === 0) return build;
  return setConsumableEntries(
    build,
    "rituals",
    clampRitualBookEntriesToWizardFreeMinimums(consumableEntries(build, "rituals"), min)
  );
}

/** Keep at least one book copy of each spellbook free ritual still selected on the Class tab. */
export function clampRitualBookEntriesToWizardFreeMinimums(
  entries: CharacterConsumableEntry[],
  minById: Record<string, number>
): CharacterConsumableEntry[] {
  let next = entries;
  for (const [id, min] of Object.entries(minById)) {
    if (min <= 0) continue;
    if (consumableQuantity(next, id) < min) {
      next = setConsumableQuantity(next, id, min);
    }
  }
  return next;
}

/** Ensure free spellbook ritual picks appear in the character's ritual book. */
export function mergeWizardFreeRitualsIntoBuild(build: CharacterBuild): CharacterBuild {
  const picked = collectWizardSpellbookRitualIds(build.classSelections, build.level);
  if (picked.length === 0) return build;
  let entries = consumableEntries(build, "rituals");
  for (const id of picked) {
    if (!id) continue;
    entries = addConsumableQuantity(entries, id, 1);
  }
  return setConsumableEntries(build, "rituals", entries);
}

export function validateWizardSpellbookRituals(
  index: RulesIndex,
  build: CharacterBuild,
  allowedRitualIds: Set<string>
): string[] {
  if (!characterHasWizardSpellbook(index, build)) return [];
  const errors: string[] = [];
  const ritualsById = new Map((index.rituals ?? []).map((r) => [r.id, r]));

  for (const m of visibleWizardSpellbookRitualMilestones(build.level, index)) {
    const key = wizardSpellbookRitualSelectionKey(m.level);
    const picks = parseWizardSpellbookRitualSelection(build.classSelections?.[key]);
    if (picks.length < m.pickCount) {
      errors.push(
        `Spellbook rituals: at level ${m.level}+ choose ${m.pickCount} free ritual${m.pickCount === 1 ? "" : "s"} (currently ${picks.length}).`
      );
      continue;
    }
    const seen = new Set<string>();
    for (const rid of picks) {
      if (!allowedRitualIds.has(rid)) {
        errors.push(`Spellbook rituals: invalid ritual at level ${m.level} milestone.`);
        break;
      }
      const ritual = ritualsById.get(rid);
      if (ritual?.level != null && ritual.level > m.level) {
        errors.push(
          `Spellbook rituals: ${ritual.name} is level ${ritual.level}; level ${m.level} milestone allows rituals of level ${m.level} or lower.`
        );
      }
      if (seen.has(rid)) {
        errors.push(`Spellbook rituals: choose different rituals at level ${m.level} milestone.`);
        break;
      }
      seen.add(rid);
    }
  }

  const allPicks = collectWizardSpellbookRitualIds(build.classSelections, build.level).filter(Boolean);
  const globalSeen = new Set<string>();
  for (const rid of allPicks) {
    if (globalSeen.has(rid)) {
      const name = ritualsById.get(rid)?.name ?? rid;
      errors.push(`Spellbook rituals: ${name} was chosen more than once; pick each free ritual only once.`);
      break;
    }
    globalSeen.add(rid);
  }

  return errors;
}
