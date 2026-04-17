import { Race, RacialTrait } from "./models";

/** Comma-separated internal_ids from `race.raw.specific["Racial Traits"]`. */
export function parseRacialTraitIdsFromRace(race: Race | undefined): string[] {
  const spec = race?.raw?.specific as Record<string, unknown> | undefined;
  const raw = String(spec?.["Racial Traits"] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveRacialTraitsForRace(
  race: Race | undefined,
  traitsById: Map<string, RacialTrait>
): Array<{ id: string; trait?: RacialTrait }> {
  return parseRacialTraitIdsFromRace(race).map((id) => ({
    id,
    trait: traitsById.get(id)
  }));
}
