import { getDilettanteCandidatePowers } from "./classPowersQuery";
import {
  racePowerGroupsForRace,
  racePowerSelectSelectionKey,
  type RacePowerGroup
} from "./grantedPowersQuery";
import type { CharacterBuild, Power, RacialTrait, RulesIndex } from "./models";
import { getRaceExtraTraitIds } from "./raceSubraces";

/** Override compendium usage for display/grants (e.g. Half-Elf Dilettante → Encounter). */
export function applyPowerUsageOverride(power: Power, usage: string): Power {
  const raw = power.raw ? { ...power.raw } : {};
  const specific = { ...((raw.specific as Record<string, unknown> | undefined) || {}) };
  specific["Power Usage"] = usage;
  return { ...power, usage, raw: { ...raw, specific } };
}

/** Applies Half-Elf Dilettante: the chosen at-will is used as an encounter power. */
export function powerAsDilettanteEncounter(power: Power): Power {
  return applyPowerUsageOverride(power, "Encounter");
}

function dilettanteUsageForTrait(trait: RacialTrait | undefined): string {
  return trait?.powerUsageOverride?.trim() || "Encounter";
}

export function isDilettantePowerIdForBuild(index: RulesIndex, build: CharacterBuild, powerId: string): boolean {
  return collectDilettantePowerIdsForBuild(index, build).includes(powerId);
}

export function resolveDilettantePowerPick(
  build: CharacterBuild,
  traitId: string
): string | undefined {
  const pick = build.raceSelections?.[racePowerSelectSelectionKey(traitId)]?.trim();
  return pick || undefined;
}

export function dilettanteRacePowerGroupsForBuild(
  index: RulesIndex,
  build: Pick<CharacterBuild, "raceId" | "raceSelections">
): RacePowerGroup[] {
  const race = index.races.find((r) => r.id === build.raceId);
  if (!race) return [];
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const extraTraitIds = getRaceExtraTraitIds(race, traitsById, build.raceSelections, index.races);
  return racePowerGroupsForRace(race, traitsById, extraTraitIds).filter((g) => g.dilettantePick);
}

export function collectDilettantePowerIdsForBuild(index: RulesIndex, build: CharacterBuild): string[] {
  const ids: string[] = [];
  for (const g of dilettanteRacePowerGroupsForBuild(index, build)) {
    const pick = resolveDilettantePowerPick(build, g.traitId);
    if (pick) ids.push(pick);
  }
  return ids;
}

export function collectDilettantePowersForBuild(index: RulesIndex, build: CharacterBuild): Power[] {
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const out: Power[] = [];
  for (const g of dilettanteRacePowerGroupsForBuild(index, build)) {
    const pick = resolveDilettantePowerPick(build, g.traitId);
    if (!pick) continue;
    const p = index.powers.find((x) => x.id === pick);
    if (!p) continue;
    out.push(applyPowerUsageOverride(p, dilettanteUsageForTrait(traitsById.get(g.traitId))));
  }
  return out;
}

export function resolveDilettanteDisplayPower(
  index: RulesIndex,
  build: CharacterBuild,
  powerId: string
): Power | undefined {
  const p = index.powers.find((x) => x.id === powerId);
  if (!p) return undefined;
  if (!isDilettantePowerIdForBuild(index, build, powerId)) return p;
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  for (const g of dilettanteRacePowerGroupsForBuild(index, build)) {
    if (resolveDilettantePowerPick(build, g.traitId) === powerId) {
      return applyPowerUsageOverride(p, dilettanteUsageForTrait(traitsById.get(g.traitId)));
    }
  }
  return powerAsDilettanteEncounter(p);
}

export function getDilettanteCandidatePowersForBuild(
  index: RulesIndex,
  build: Pick<CharacterBuild, "characterStyle" | "classId" | "hybridClassIdA" | "hybridClassIdB">
): Power[] {
  const isHybrid = build.characterStyle === "hybrid";
  const myClassId = isHybrid
    ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdA)?.baseClassId
    : build.classId;
  const alsoMyClassId =
    isHybrid && build.hybridClassIdB
      ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdB)?.baseClassId
      : undefined;
  return getDilettanteCandidatePowers(index, myClassId, alsoMyClassId);
}
