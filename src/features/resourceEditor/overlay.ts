import type { RulesIndex } from "../../rules/models";

export const RESOURCE_EDITOR_OVERLAY_VERSION = 1;

export type EditableResourceCollection =
  | "races"
  | "classes"
  | "powers"
  | "feats"
  | "themes"
  | "paragonPaths"
  | "epicDestinies"
  | "racialTraits"
  | "hybridClasses"
  | "armors"
  | "weapons"
  | "implements";

export interface ResourceCollectionOverlay {
  upserts: Record<string, unknown>;
  deletes: string[];
}

export interface ResourceEditorOverlay {
  version: number;
  collections: Partial<Record<EditableResourceCollection, ResourceCollectionOverlay>>;
}

export const EDITABLE_RESOURCE_COLLECTIONS: EditableResourceCollection[] = [
  "races",
  "classes",
  "powers",
  "feats",
  "themes",
  "paragonPaths",
  "epicDestinies",
  "racialTraits",
  "hybridClasses",
  "armors",
  "weapons",
  "implements"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0;
}

function normalizeCollectionOverlay(input: unknown): ResourceCollectionOverlay {
  if (!isRecord(input)) {
    return { upserts: {}, deletes: [] };
  }
  const rawUpserts = isRecord(input.upserts) ? input.upserts : {};
  const rawDeletes = Array.isArray(input.deletes) ? input.deletes : [];
  const upserts: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(rawUpserts)) {
    if (typeof id === "string" && id.length > 0 && hasStringId(entry)) {
      upserts[id] = entry;
    }
  }
  const deletes = rawDeletes.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return { upserts, deletes };
}

export function emptyResourceEditorOverlay(): ResourceEditorOverlay {
  return { version: RESOURCE_EDITOR_OVERLAY_VERSION, collections: {} };
}

export function normalizeResourceEditorOverlay(input: unknown): ResourceEditorOverlay {
  if (!isRecord(input)) {
    return emptyResourceEditorOverlay();
  }
  const rawCollections = isRecord(input.collections) ? input.collections : {};
  const collections: Partial<Record<EditableResourceCollection, ResourceCollectionOverlay>> = {};
  for (const key of EDITABLE_RESOURCE_COLLECTIONS) {
    if (key in rawCollections) {
      collections[key] = normalizeCollectionOverlay(rawCollections[key]);
    }
  }
  return {
    version: RESOURCE_EDITOR_OVERLAY_VERSION,
    collections
  };
}

function applyCollectionOverlay<T extends { id: string }>(
  baseItems: T[] | undefined,
  overlay: ResourceCollectionOverlay | undefined
): T[] {
  const current = [...(baseItems ?? [])];
  if (!overlay) {
    return current;
  }
  const deleteSet = new Set(overlay.deletes);
  const upsertsById = new Map<string, T>();
  for (const [key, value] of Object.entries(overlay.upserts)) {
    if (hasStringId(value) && value.id === key) {
      upsertsById.set(key, value as T);
    }
  }

  const merged = current
    .filter((item) => !deleteSet.has(item.id))
    .map((item) => {
      const replacement = upsertsById.get(item.id);
      if (replacement) {
        upsertsById.delete(item.id);
        return replacement;
      }
      return item;
    });

  for (const value of upsertsById.values()) {
    if (!deleteSet.has(value.id)) {
      merged.push(value);
    }
  }
  return merged;
}

export function mergeRulesOverlay(baseIndex: RulesIndex, overlay: ResourceEditorOverlay): RulesIndex {
  const normalized = normalizeResourceEditorOverlay(overlay);
  return {
    ...baseIndex,
    races: applyCollectionOverlay(baseIndex.races, normalized.collections.races),
    classes: applyCollectionOverlay(baseIndex.classes, normalized.collections.classes),
    powers: applyCollectionOverlay(baseIndex.powers, normalized.collections.powers),
    feats: applyCollectionOverlay(baseIndex.feats, normalized.collections.feats),
    themes: applyCollectionOverlay(baseIndex.themes, normalized.collections.themes),
    paragonPaths: applyCollectionOverlay(baseIndex.paragonPaths, normalized.collections.paragonPaths),
    epicDestinies: applyCollectionOverlay(baseIndex.epicDestinies, normalized.collections.epicDestinies),
    racialTraits: applyCollectionOverlay(baseIndex.racialTraits, normalized.collections.racialTraits),
    hybridClasses: applyCollectionOverlay(baseIndex.hybridClasses, normalized.collections.hybridClasses),
    armors: applyCollectionOverlay(baseIndex.armors, normalized.collections.armors),
    weapons: applyCollectionOverlay(baseIndex.weapons, normalized.collections.weapons),
    implements: applyCollectionOverlay(baseIndex.implements, normalized.collections.implements)
  };
}
