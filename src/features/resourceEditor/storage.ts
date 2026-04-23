import {
  emptyResourceEditorOverlay,
  normalizeResourceEditorOverlay,
  type ResourceEditorOverlay
} from "./overlay";

const RESOURCE_EDITOR_STORAGE_KEY = "dnd4e_resource_editor_overlay_v1";

export function loadResourceEditorOverlay(): ResourceEditorOverlay {
  const raw = localStorage.getItem(RESOURCE_EDITOR_STORAGE_KEY);
  if (!raw) {
    return emptyResourceEditorOverlay();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeResourceEditorOverlay(parsed);
  } catch {
    return emptyResourceEditorOverlay();
  }
}

export function saveResourceEditorOverlay(overlay: ResourceEditorOverlay): void {
  localStorage.setItem(RESOURCE_EDITOR_STORAGE_KEY, JSON.stringify(normalizeResourceEditorOverlay(overlay)));
}

export function resetResourceEditorOverlay(): ResourceEditorOverlay {
  localStorage.removeItem(RESOURCE_EDITOR_STORAGE_KEY);
  return emptyResourceEditorOverlay();
}
