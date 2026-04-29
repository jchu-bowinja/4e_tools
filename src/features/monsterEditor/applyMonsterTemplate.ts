import type { MonsterEntryFile, MonsterPower, MonsterTemplateRecord, MonsterTrait } from "./storage";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function traitSignature(trait: MonsterTrait): string {
  return [normName(trait.name), String(trait.range ?? ""), normName(trait.details)].join("|");
}

export function powerSignature(power: MonsterPower): string {
  return normName(power.name);
}

export type TemplateApplicationDelta = {
  addedPowerNames: string[];
  addedTraitNames: string[];
  addedAuraNames: string[];
  skippedDuplicatePowers: number;
  skippedDuplicateTraits: number;
  skippedDuplicateAuras: number;
};

export function computeTemplateApplicationDelta(
  base: MonsterEntryFile,
  template: MonsterTemplateRecord
): TemplateApplicationDelta {
  const basePower = new Set((base.powers ?? []).map(powerSignature));
  const baseAura = new Set((base.auras ?? []).map(traitSignature));
  const baseTrait = new Set((base.traits ?? []).map(traitSignature));

  const addedPowerNames: string[] = [];
  let skippedDuplicatePowers = 0;
  for (const p of template.powers ?? []) {
    const sig = powerSignature(p);
    if (basePower.has(sig)) skippedDuplicatePowers++;
    else addedPowerNames.push(String(p.name ?? "").trim() || "(unnamed power)");
  }

  const addedAuraNames: string[] = [];
  let skippedDuplicateAuras = 0;
  for (const a of template.auras ?? []) {
    const sig = traitSignature(a);
    if (baseAura.has(sig)) skippedDuplicateAuras++;
    else addedAuraNames.push(String(a.name ?? "").trim() || "(unnamed aura)");
  }

  const addedTraitNames: string[] = [];
  let skippedDuplicateTraits = 0;
  for (const t of template.traits ?? []) {
    const sig = traitSignature(t);
    if (baseTrait.has(sig)) skippedDuplicateTraits++;
    else addedTraitNames.push(String(t.name ?? "").trim() || "(unnamed trait)");
  }

  return {
    addedPowerNames,
    addedTraitNames,
    addedAuraNames,
    skippedDuplicatePowers,
    skippedDuplicateTraits,
    skippedDuplicateAuras
  };
}

/**
 * Merge a monster template onto a base creature for preview: append template powers, traits, and auras
 * (deduped by name/signature). Base statistics and identity are unchanged.
 */
export function applyMonsterTemplateToEntry(entry: MonsterEntryFile, template: MonsterTemplateRecord): MonsterEntryFile {
  const out = deepClone(entry);
  const powerKeys = new Set((out.powers ?? []).map(powerSignature));
  out.powers = [...(out.powers ?? [])];
  for (const p of template.powers ?? []) {
    const sig = powerSignature(p);
    if (!powerKeys.has(sig)) {
      out.powers.push(deepClone(p));
      powerKeys.add(sig);
    }
  }

  const auraKeys = new Set((out.auras ?? []).map(traitSignature));
  out.auras = [...(out.auras ?? [])];
  for (const a of template.auras ?? []) {
    const sig = traitSignature(a);
    if (!auraKeys.has(sig)) {
      out.auras.push(deepClone(a));
      auraKeys.add(sig);
    }
  }

  const traitKeys = new Set((out.traits ?? []).map(traitSignature));
  out.traits = [...(out.traits ?? [])];
  for (const t of template.traits ?? []) {
    const sig = traitSignature(t);
    if (!traitKeys.has(sig)) {
      out.traits.push(deepClone(t));
      traitKeys.add(sig);
    }
  }

  out.sections = {
    ...(out.sections ?? {}),
    monsterTemplatePreview: {
      templateName: template.templateName,
      sourceBook: template.sourceBook
    }
  };

  return out;
}
