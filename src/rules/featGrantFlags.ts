import type { CharacterBuild, Feat, RulesIndex } from "./models";

/** Multiclass training feat (counts as another class), not weapon-training-only rows. */
export function isMulticlassEntryFeat(feat: Feat | undefined): boolean {
  if (!feat) return false;
  return Boolean(feat.hasMulticlassGrant && (feat.countsAsClassNames?.length ?? 0) > 0);
}

/** Feat carries the Character Builder Multiclass internal grant. */
export function featHasMulticlassGrant(feat: Feat | undefined): boolean {
  if (!feat) return false;
  if (feat.hasMulticlassGrant) return true;
  const n = (feat.name || "").toLowerCase();
  const c = (feat.category || "").toLowerCase();
  return n.includes("multiclass") || c.includes("multiclass");
}

export function hasMulticlassEntryFeat(index: RulesIndex, build: CharacterBuild): boolean {
  return collectMulticlassEntryFeatIds(index, build).length > 0;
}

export function collectMulticlassEntryFeatIds(index: RulesIndex, build: CharacterBuild): string[] {
  const out: string[] = [];
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    if (isMulticlassEntryFeat(feat)) out.push(id);
  }
  return out;
}

export function collectMulticlassFeatIds(index: RulesIndex, build: CharacterBuild): string[] {
  const out: string[] = [];
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    if (featHasMulticlassGrant(feat)) out.push(id);
  }
  return out;
}

/** Class display names granted by CountsAsClass on selected feats. */
export function collectCountsAsClassNames(index: RulesIndex, build: CharacterBuild): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    for (const label of feat?.countsAsClassNames ?? []) {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(label);
    }
  }
  return names;
}

/** Resolved class ids from CountsAsClass grants on selected feats. */
export function collectCountsAsClassIds(index: RulesIndex, build: CharacterBuild): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    for (const cid of feat?.countsAsClassIds ?? []) {
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      ids.push(cid);
    }
  }
  return ids;
}

/** Trained skill ids granted by feats (Skill Training grants). */
export function collectFeatGrantedSkillTrainingIds(index: RulesIndex, build: CharacterBuild): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const fid of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === fid);
    for (const sid of feat?.grantedSkillTrainingIds ?? []) {
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      ids.push(sid);
    }
  }
  return ids;
}

/** Class feature names from CountsAsFeature grants on selected feats. */
export function collectCountsAsFeatureNames(index: RulesIndex, build: CharacterBuild): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    for (const label of feat?.countsAsFeatureNames ?? []) {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(label);
    }
  }
  return names;
}

export function characterHasKiFocusUser(index: RulesIndex, build: CharacterBuild): boolean {
  return collectInternalGrantKeys(index, build).includes("KI_FOCUS_USER");
}

export function characterHasPsionicSecondClass(index: RulesIndex, build: CharacterBuild): boolean {
  return collectInternalGrantKeys(index, build).includes("PSIONIC_SECOND_CLASS");
}

/** Rare sources (e.g. some races) grant unlimited multiclass — detected via feat/race tags later. */
export function characterHasUnlimitedMulticlass(index: RulesIndex, build: CharacterBuild): boolean {
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    const tags = feat?.tags ?? [];
    if (tags.some((t) => String(t).toLowerCase().includes("unlimited multiclass"))) return true;
    const n = (feat?.name || "").toLowerCase();
    if (n.includes("unlimited multiclass")) return true;
  }
  return false;
}

/** True when any selected feat carries a bloodline internal grant. */
export function characterHasBloodline(index: RulesIndex, build: CharacterBuild): boolean {
  for (const key of collectInternalGrantKeys(index, build)) {
    if (key.includes("BLOODLINE")) return true;
  }
  return false;
}

/** Internal grant keys from selected feats (bloodline, ki focus, etc.). */
export function collectInternalGrantKeys(index: RulesIndex, build: CharacterBuild): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const id of build.featIds ?? []) {
    const feat = index.feats.find((f) => f.id === id);
    for (const key of feat?.internalGrantKeys ?? []) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/** Human-readable label for an internal grant key. */
export function formatInternalGrantKey(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
