import { CharacterBuild } from "../../rules/models";

const STORAGE_KEY = "dnd4e_builder_character_v1";

export function saveBuild(build: CharacterBuild): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
}

export function loadBuild(): CharacterBuild | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CharacterBuild;
  } catch {
    return null;
  }
}

