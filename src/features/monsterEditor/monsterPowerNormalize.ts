import type { MonsterPower, MonsterPowerAttack } from "./storage";
import { enrichMonsterPowerOutcomes } from "./monsterOutcomeSubconditions";

const VS_RE = /(level\s*\+\s*\d+|[+-]?\d+)\s+vs\.?\s*(AC|Fortitude|Reflex|Will)/i;
const DAMAGE_RE = /(?:\d+d\d+(?:\s*[+-]\s*\d+)?(?:\s+\w+)?)/gi;

function splitKeywords(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function uniqTokens(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const t = value.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function inferAttackFromDescription(description: string): MonsterPowerAttack[] | undefined {
  const vs = description.match(VS_RE);
  if (!vs) return undefined;
  const bonusRaw = vs[1].replace(/\s+/g, "");
  const bonus: number | string =
    /^-?\d+$/.test(bonusRaw) ? Number.parseInt(bonusRaw, 10) : bonusRaw.toLowerCase().replace("level+", "level + ");
  const defense = vs[2].replace(/\b\w/g, (c) => c.toUpperCase());
  return [
    {
      kind: "MonsterAttack",
      name: "Hit",
      attackBonuses: [{ defense, bonus }],
      hit: { description }
    }
  ];
}

function inferDamageExpressions(description: string): string[] | undefined {
  const matches = description.match(DAMAGE_RE);
  if (!matches || matches.length === 0) return undefined;
  return uniqTokens(matches.map((m) => m.replace(/\s+/g, " ").trim()));
}

function inferTypeFromRange(range: string): string | undefined {
  const m = range.match(/^(Melee|Ranged|Close|Area|Aura)\b/i);
  return m ? m[1].replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
}

export function normalizeMonsterPowerShape(power: MonsterPower): MonsterPower {
  const name = String(power.name ?? "").trim();
  const usage = String(power.usage ?? "").trim();
  const action = String(power.action ?? "").trim();
  const description = String(power.description ?? "").trim();
  const range = String(power.range ?? "").trim();

  const keywordTokens = uniqTokens([
    ...(Array.isArray(power.keywordTokens) ? power.keywordTokens.map(String) : []),
    ...(Array.isArray(power.keywordNames) ? power.keywordNames.map(String) : []),
    ...splitKeywords(String(power.keywords ?? ""))
  ]);

  const attacks =
    Array.isArray(power.attacks) && power.attacks.length > 0 ? power.attacks : inferAttackFromDescription(description);
  const damageExpressions =
    Array.isArray(power.damageExpressions) && power.damageExpressions.length > 0
      ? power.damageExpressions.map(String)
      : inferDamageExpressions(description);
  const inferredType = String(power.type ?? "").trim() || inferTypeFromRange(range) || "";

  return enrichMonsterPowerOutcomes({
    ...power,
    name,
    usage,
    action,
    description,
    range,
    type: inferredType || undefined,
    keywordTokens,
    keywordNames: keywordTokens,
    keywords: keywordTokens.join(", "),
    damageExpressions,
    attacks
  });
}
