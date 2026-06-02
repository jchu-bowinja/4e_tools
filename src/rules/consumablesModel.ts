import type { CharacterConsumableEntry, CharacterBuild } from "./models";

export type ConsumableListKey = "gear" | "rituals" | "martialPractices" | "alchemy";

const LIST_KEYS: ConsumableListKey[] = ["gear", "rituals", "martialPractices", "alchemy"];

const LEGACY_ID_KEYS: Record<ConsumableListKey, keyof CharacterBuild> = {
  gear: "gearIds",
  rituals: "ritualIds",
  martialPractices: "martialPracticeIds",
  alchemy: "alchemyItemIds"
};

export function normalizeConsumableEntry(raw: unknown): CharacterConsumableEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Partial<CharacterConsumableEntry>;
  if (typeof v.id !== "string" || !v.id.trim()) return null;
  const quantity = Math.max(0, Math.trunc(Number(v.quantity) || 0));
  if (quantity <= 0) return null;
  return { id: v.id, quantity };
}

export function normalizeConsumableEntries(value: unknown): CharacterConsumableEntry[] {
  if (!Array.isArray(value)) return [];
  const out: CharacterConsumableEntry[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const entry = normalizeConsumableEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

function legacyIdsForList(build: CharacterBuild, key: ConsumableListKey): string[] | undefined {
  const legacyKey = LEGACY_ID_KEYS[key];
  const raw = build[legacyKey];
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

/** Read consumable list from build (new shape or legacy `*Ids` arrays). */
export function consumableEntries(build: CharacterBuild, key: ConsumableListKey): CharacterConsumableEntry[] {
  const modern = build[key];
  if (Array.isArray(modern) && modern.length > 0) {
    return normalizeConsumableEntries(modern);
  }
  const legacy = legacyIdsForList(build, key);
  if (!legacy?.length) return [];
  return legacy.map((id) => ({ id, quantity: 1 }));
}

export function setConsumableEntries(
  build: CharacterBuild,
  key: ConsumableListKey,
  entries: CharacterConsumableEntry[]
): CharacterBuild {
  const normalized = normalizeConsumableEntries(entries);
  const next: CharacterBuild = { ...build, [key]: normalized.length > 0 ? normalized : undefined };
  const legacyKey = LEGACY_ID_KEYS[key];
  if (legacyKey in next) {
    const { [legacyKey]: _removed, ...rest } = next as CharacterBuild & Record<string, unknown>;
    return rest as CharacterBuild;
  }
  return next;
}

export function consumableQuantity(entries: CharacterConsumableEntry[], id: string): number {
  return entries.find((e) => e.id === id)?.quantity ?? 0;
}

export function addConsumableQuantity(
  entries: CharacterConsumableEntry[],
  id: string,
  delta: number
): CharacterConsumableEntry[] {
  const add = Math.trunc(delta);
  if (add <= 0) return entries;
  const existing = entries.find((e) => e.id === id);
  if (existing) {
    return entries.map((e) => (e.id === id ? { ...e, quantity: e.quantity + add } : e));
  }
  return [...entries, { id, quantity: add }];
}

export function setConsumableQuantity(
  entries: CharacterConsumableEntry[],
  id: string,
  quantity: number
): CharacterConsumableEntry[] {
  const qty = Math.max(0, Math.trunc(quantity));
  const without = entries.filter((e) => e.id !== id);
  if (qty <= 0) return without;
  return [...without, { id, quantity: qty }];
}

export function removeConsumableEntry(entries: CharacterConsumableEntry[], id: string): CharacterConsumableEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Strip legacy `*Ids` fields and normalize modern lists on save/load. */
export function migrateCharacterConsumables(build: CharacterBuild): CharacterBuild {
  let next = { ...build };
  for (const key of LIST_KEYS) {
    const entries = consumableEntries(next, key);
    next = setConsumableEntries(next, key, entries);
  }
  const stripped = { ...next } as CharacterBuild & Record<string, unknown>;
  for (const legacyKey of Object.values(LEGACY_ID_KEYS)) {
    delete stripped[legacyKey];
  }
  return stripped as CharacterBuild;
}

export function pruneConsumableEntries(
  entries: CharacterConsumableEntry[],
  allowed: ReadonlySet<string>
): CharacterConsumableEntry[] {
  return normalizeConsumableEntries(entries.filter((e) => allowed.has(e.id)));
}
