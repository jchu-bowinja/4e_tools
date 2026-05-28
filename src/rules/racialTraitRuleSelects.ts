import type { CharacterBuild, ClassDef, Race, RacialTrait, RulesIndex } from "./models";
import { getRaceExtraTraitIds } from "./raceSubraces";
import { parseRacialTraitIdsFromRace } from "./racialTraits";

export type RacialTraitRuleSelectKind = "skillTraining" | "feat" | "countsAsRace";

export interface RacialTraitRuleSelectSlot {
  kind: RacialTraitRuleSelectKind;
  key: string;
  traitId: string;
  traitName: string;
  label: string;
  /** When set, only these class names match a `requires` rule (Bonus Skill). */
  requiresClassName?: string;
}

export function racialTraitRuleSelectKey(
  kind: RacialTraitRuleSelectKind,
  traitId: string,
  index = 0
): string {
  if (kind === "countsAsRace") return `countsAsRace:${traitId}`;
  if (kind === "feat") return `racialFeat:${traitId}`;
  return `skillTraining:${traitId}:${index}`;
}

function ruleSelectEntries(trait: RacialTrait): unknown[] {
  const rules = trait.raw?.rules as Record<string, unknown> | undefined;
  const sel = rules?.select;
  return Array.isArray(sel) ? sel : [];
}

function selectAttrs(entry: unknown): Record<string, string> {
  if (!entry || typeof entry !== "object") return {};
  const attrs = (entry as { attrs?: unknown }).attrs;
  if (!attrs || typeof attrs !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function selectCount(attrs: Record<string, string>): number {
  const n = Number(attrs.number);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

/** Whether a compendium `requires` attribute matches the selected class name. */
export function raceTraitSelectRequiresMatches(
  requires: string | undefined,
  className: string | undefined
): boolean {
  const req = (requires || "").trim();
  if (!req) return true;
  const cls = (className || "").trim();
  if (!cls) return false;
  if (req.startsWith("!")) {
    const blocked = req
      .slice(1)
      .split("|")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return !blocked.includes(cls.toLowerCase());
  }
  return req.toLowerCase() === cls.toLowerCase();
}

function collectTraitIdsForRuleSelectScan(
  race: Race,
  traitsById: Map<string, RacialTrait>,
  raceSelections: Record<string, string> | undefined,
  races: Race[] | undefined
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [
    ...parseRacialTraitIdsFromRace(race),
    ...getRaceExtraTraitIds(race, traitsById, raceSelections, races)
  ]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Trait-level `rules.select` slots (skill training, bonus feat, revenant past life).
 * Race-level language/skill bonus picks stay in `getRaceSecondarySelectSlots`.
 */
export function countRacialTraitRuleSelectSlotsByKind(
  slots: RacialTraitRuleSelectSlot[],
  kind: RacialTraitRuleSelectKind
): number {
  return slots.filter((s) => s.kind === kind).length;
}

function classDefForRacialRuleSelects(
  index: Pick<RulesIndex, "classes">,
  build: Pick<CharacterBuild, "classId" | "characterStyle">
): ClassDef | undefined {
  if (build.characterStyle === "hybrid") return undefined;
  return index.classes?.find((c) => c.id === build.classId);
}

/** Bonus feat picks granted by racial traits (e.g. Human Bonus Feat); chosen on the Feats tab. */
export function resolveRacialFeatSlotCountForBuild(
  index: Pick<RulesIndex, "races" | "racialTraits" | "classes">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections" | "classId" | "characterStyle">
): number {
  const race = index.races?.find((r) => r.id === build.raceId);
  if (!race) return 0;
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const slots = getRacialTraitRuleSelectSlots(
    race,
    traitsById,
    build.raceSelections,
    classDefForRacialRuleSelects(index, build),
    index.races
  );
  return countRacialTraitRuleSelectSlotsByKind(slots, "feat");
}

/** Bonus trained-skill picks from racial traits (e.g. Human Bonus Skill); chosen on the Skills tab. */
export function resolveRacialSkillTrainingSlotCountForBuild(
  index: Pick<RulesIndex, "races" | "racialTraits" | "classes">,
  build: Pick<CharacterBuild, "raceId" | "raceSelections" | "classId" | "characterStyle">
): number {
  const race = index.races?.find((r) => r.id === build.raceId);
  if (!race) return 0;
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const slots = getRacialTraitRuleSelectSlots(
    race,
    traitsById,
    build.raceSelections,
    classDefForRacialRuleSelects(index, build),
    index.races
  );
  return countRacialTraitRuleSelectSlotsByKind(slots, "skillTraining");
}

/** Race tab: subrace / past life only — feat and skill picks use Feats / Skills tabs. */
export function getRacialTraitRuleSelectSlotsForRaceTab(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections: Record<string, string> | undefined,
  classDef: ClassDef | undefined,
  races?: Race[]
): RacialTraitRuleSelectSlot[] {
  return getRacialTraitRuleSelectSlots(race, traitsById, raceSelections, classDef, races).filter(
    (s) => s.kind === "countsAsRace"
  );
}

export function getRacialTraitRuleSelectSlots(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>,
  raceSelections: Record<string, string> | undefined,
  classDef: ClassDef | undefined,
  races?: Race[]
): RacialTraitRuleSelectSlot[] {
  if (!race) return [];
  const className = classDef?.name;
  const slots: RacialTraitRuleSelectSlot[] = [];
  for (const traitId of collectTraitIdsForRuleSelectScan(race, traitsById, raceSelections, races)) {
    const trait = traitsById.get(traitId);
    if (!trait) continue;
    let skillIdx = 0;
    for (const entry of ruleSelectEntries(trait)) {
      const attrs = selectAttrs(entry);
      const n = selectCount(attrs);
      if (n <= 0) continue;
      const type = attrs.type;
      if (type === "Skill Training") {
        if (!raceTraitSelectRequiresMatches(attrs.requires, className)) continue;
        const key = racialTraitRuleSelectKey("skillTraining", traitId, skillIdx);
        skillIdx += 1;
        slots.push({
          kind: "skillTraining",
          key,
          traitId,
          traitName: trait.name,
          label:
            skillIdx === 1
              ? `${trait.name} — trained skill`
              : `${trait.name} — trained skill (${skillIdx})`,
          requiresClassName: attrs.requires?.startsWith("!") ? undefined : className
        });
      } else if (type === "Feat") {
        slots.push({
          kind: "feat",
          key: racialTraitRuleSelectKey("feat", traitId),
          traitId,
          traitName: trait.name,
          label: `${trait.name} — choose feat`
        });
      } else if (type === "CountsAsRace") {
        slots.push({
          kind: "countsAsRace",
          key: racialTraitRuleSelectKey("countsAsRace", traitId),
          traitId,
          traitName: trait.name,
          label: trait.name
        });
      }
    }
  }
  return slots;
}

/** Races offered for Past life / CountsAsRace (excludes Revenant and internal-only rows). */
export function countsAsRaceOptions(index: RulesIndex, currentRaceId: string | undefined): Race[] {
  const blocked = new Set(
    (index.races ?? [])
      .filter((r) => /revenant/i.test(r.name))
      .map((r) => r.id)
  );
  if (currentRaceId) blocked.add(currentRaceId);
  return (index.races ?? [])
    .filter((r) => !blocked.has(r.id) && r.name.trim().toLowerCase() !== "hybrid")
    .filter((r) => r.name.trim().toLowerCase() !== "any class")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

