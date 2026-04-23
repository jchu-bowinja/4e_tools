import { getPowersForOwnerId } from "./classPowersQuery";
import {
  autoGrantedClassPowers,
  parseFeatAssociatedPowerNames,
  racePowerGroupsForRace,
  racePowerSelectSelectionKey,
  resolvePowersByLooseNames
} from "./grantedPowersQuery";
import type { CharacterBuild, RulesIndex } from "./models";
import { getChildTraitIdsForSubrace, getRaceSubraceData } from "./raceSubraces";

/**
 * Every power instance the character has from class slots, race, auto-granted class/theme/path/destiny, and feats
 * (matches where the builder shows power cards with optional construction picks).
 */
export function collectCharacterPowerIdsForSelections(index: RulesIndex, build: CharacterBuild): Set<string> {
  const ids = new Set<string>(build.powerIds);
  const race = index.races.find((r) => r.id === build.raceId);
  const traitsById = new Map((index.racialTraits ?? []).map((t) => [t.id, t]));
  const raceSubraceData = getRaceSubraceData(race, traitsById);
  const subPick = build.raceSelections?.["subrace"];
  const selectedSubrace =
    subPick && raceSubraceData ? raceSubraceData.options.find((o) => o.id === subPick) : undefined;
  const extraTraitIds: string[] = [];
  if (selectedSubrace) {
    extraTraitIds.push(selectedSubrace.id);
    extraTraitIds.push(...getChildTraitIdsForSubrace(selectedSubrace));
  }
  for (const g of racePowerGroupsForRace(race, traitsById, extraTraitIds)) {
    if (g.choiceOnly) {
      const pick = build.raceSelections?.[racePowerSelectSelectionKey(g.traitId)];
      if (pick) ids.add(pick);
    } else {
      for (const pid of g.powerIds) ids.add(pid);
    }
  }

  const hybridA =
    build.characterStyle === "hybrid" ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdA) : undefined;
  const hybridB =
    build.characterStyle === "hybrid" ? index.hybridClasses?.find((h) => h.id === build.hybridClassIdB) : undefined;
  if (build.characterStyle === "hybrid" && hybridA?.baseClassId && hybridB?.baseClassId) {
    for (const p of autoGrantedClassPowers(index, hybridA.baseClassId)) ids.add(p.id);
    for (const p of autoGrantedClassPowers(index, hybridB.baseClassId)) ids.add(p.id);
  } else if (build.classId) {
    for (const p of autoGrantedClassPowers(index, build.classId)) ids.add(p.id);
  }

  const theme = index.themes.find((t) => t.id === build.themeId);
  if (theme) {
    for (const p of getPowersForOwnerId(index, theme.id, build.level, "attack")) ids.add(p.id);
    for (const p of getPowersForOwnerId(index, theme.id, build.level, "utility")) ids.add(p.id);
  }
  const paragon = index.paragonPaths.find((p) => p.id === build.paragonPathId);
  if (paragon) {
    for (const p of getPowersForOwnerId(index, paragon.id, build.level, "attack")) ids.add(p.id);
    for (const p of getPowersForOwnerId(index, paragon.id, build.level, "utility")) ids.add(p.id);
  }
  const epic = index.epicDestinies.find((d) => d.id === build.epicDestinyId);
  if (epic) {
    for (const p of getPowersForOwnerId(index, epic.id, build.level, "attack")) ids.add(p.id);
    for (const p of getPowersForOwnerId(index, epic.id, build.level, "utility")) ids.add(p.id);
  }

  for (const fid of build.featIds) {
    const feat = index.feats.find((f) => f.id === fid);
    if (!feat) continue;
    const names = parseFeatAssociatedPowerNames(feat);
    for (const p of resolvePowersByLooseNames(index, names)) ids.add(p.id);
  }

  return ids;
}

/** Drop `powerSelections` for powers the character no longer has (including granted racial powers). */
export function pruneStalePowerSelections(index: RulesIndex, build: CharacterBuild): CharacterBuild {
  const valid = collectCharacterPowerIdsForSelections(index, build);
  const ps = build.powerSelections;
  if (!ps) return build;
  const next: Record<string, Record<string, string>> = {};
  for (const [pid, m] of Object.entries(ps)) {
    if (!valid.has(pid)) continue;
    next[pid] = { ...m };
  }
  return { ...build, powerSelections: Object.keys(next).length > 0 ? next : undefined };
}
