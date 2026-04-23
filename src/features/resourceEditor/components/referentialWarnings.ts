import type { RulesIndex } from "../../../rules/models";
import type { EditableResourceCollection } from "../overlay";

function hasText(haystack: unknown, needle: string): boolean {
  if (typeof haystack !== "string" || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function getReferentialWarnings(
  collection: EditableResourceCollection,
  draft: Record<string, unknown>,
  index: RulesIndex,
  selectedId: string
): string[] {
  const warnings: string[] = [];
  const id = typeof draft.id === "string" ? draft.id.trim() : "";
  const name = typeof draft.name === "string" ? draft.name.trim() : "";

  if (!id) {
    warnings.push("ID is required before this entry can be saved.");
  }

  if (id && !selectedId) {
    const collectionItems =
      collection === "weapons"
        ? index.weapons ?? []
        : collection === "implements"
          ? index.implements ?? []
          : collection === "hybridClasses"
            ? index.hybridClasses ?? []
            : (index[collection] as Array<{ id: string }>);
    const exists = collectionItems.some((item) => item.id === id);
    if (exists) {
      warnings.push(`ID ${id} already exists in this collection.`);
    }
  }

  if (!name) {
    warnings.push("Name is recommended for readability in the builder UI.");
  }

  if (collection === "powers") {
    const classId = typeof draft.classId === "string" ? draft.classId.trim() : "";
    if (classId) {
      const classExists = index.classes.some((entry) => entry.id === classId);
      if (!classExists) {
        warnings.push(`Power classId ${classId} does not match any known class.`);
      }
    }
  }

  if (collection === "hybridClasses") {
    const baseClassId = typeof draft.baseClassId === "string" ? draft.baseClassId.trim() : "";
    if (baseClassId) {
      const exists = index.classes.some((entry) => entry.id === baseClassId);
      if (!exists) {
        warnings.push(`Hybrid baseClassId ${baseClassId} does not match any known class.`);
      }
    }
  }

  if (collection === "weapons") {
    const weaponGroup = typeof draft.weaponGroup === "string" ? draft.weaponGroup.trim() : "";
    if (!weaponGroup) {
      warnings.push("Weapon group is empty; builder prof checks often rely on category/group text.");
    }
  }

  if (collection === "implements") {
    const implementGroup = typeof draft.implementGroup === "string" ? draft.implementGroup.trim() : "";
    if (!implementGroup) {
      warnings.push("Implement group is empty; implement proficiency checks may not match.");
    } else {
      const referencedByAnyClass = index.classes.some((entry) => {
        const raw = JSON.stringify(entry.raw ?? {});
        return hasText(raw, implementGroup);
      });
      if (!referencedByAnyClass) {
        warnings.push(`No class raw data appears to reference implement group "${implementGroup}".`);
      }
    }
  }

  return warnings;
}
