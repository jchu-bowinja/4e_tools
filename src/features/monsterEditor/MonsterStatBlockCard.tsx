import type { CSSProperties, ReactElement } from "react";
import type { MonsterEntryFile, MonsterPower, MonsterTrait } from "./storage";
import { buildMonsterPowerCardViewModel } from "./monsterPowerCardViewModel";
import { formatMonsterCreatureTypeLine, isRenderableCardValue } from "./monsterTextUtils";

export type MonsterPowerActionBucket = "standard" | "minor" | "triggered" | "other";

const cardShell: CSSProperties = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  padding: "0.65rem 0.75rem",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))",
  fontSize: "0.76rem",
  lineHeight: 1.38,
  color: "var(--text-primary)",
  fontVariantNumeric: "tabular-nums"
};

const sectionHeaderStyle: CSSProperties = {
  margin: "0.55rem 0 0.2rem 0",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--panel-border)",
  paddingBottom: "0.12rem"
};

function formatXp(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const raw = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(raw)) return String(value);
  return raw.toLocaleString("en-US");
}

function pickScalar(block: Record<string, unknown> | undefined, candidates: string[]): string | undefined {
  if (!block) return undefined;
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(block)) {
    map.set(k.toLowerCase(), v);
  }
  for (const c of candidates) {
    const v = map.get(c.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatAbilityShort(code: string, score: number): string {
  const mod = abilityMod(score);
  const sign = mod >= 0 ? "+" : "";
  const short = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  return `${short} ${score} (${sign}${mod})`;
}

function readAbilityScores(monster: MonsterEntryFile): Record<string, number> {
  const raw = monster.stats?.abilityScores ?? {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const num = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(num)) out[k.toLowerCase()] = num;
  }
  return out;
}

function resistWeakLine(entry: Record<string, unknown>): string {
  const rawAmount = entry.amount;
  const amount = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
  const amountPart = Number.isFinite(amount) && amount !== 0 ? `${amount} ` : "";
  const namePart = String(entry.name ?? "").trim();
  const detailsPart = String(entry.details ?? "").trim();
  return `${amountPart}${namePart}${detailsPart ? ` ${detailsPart}` : ""}`.trim();
}

function extractMovementParts(monster: MonsterEntryFile): Array<{ type: string; value: string | number }> {
  const rawMovement = monster.stats?.otherNumbers?.movement;
  if (!Array.isArray(rawMovement)) return [];
  return rawMovement
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const record = entry as Record<string, unknown>;
      const type = String(record.type ?? "").trim();
      const valueRaw = record.value;
      const valueText = String(valueRaw ?? "").trim();
      if (!type || !valueText) return null;
      const numeric = typeof valueRaw === "number" ? valueRaw : Number(valueText);
      return { type, value: Number.isFinite(numeric) ? numeric : valueText };
    })
    .filter((entry): entry is { type: string; value: string | number } => entry !== null);
}

function formatMovementLine(monster: MonsterEntryFile): string | undefined {
  const parts = extractMovementParts(monster);
  if (parts.length === 0) return undefined;
  return parts
    .map(({ type, value }) => {
      const v = typeof value === "number" ? String(value) : String(value);
      const t = type.trim();
      return /^speed$/i.test(t) ? `Speed ${v}` : `${t} ${v}`;
    })
    .join(", ");
}

function powerRangeGlyph(power: MonsterPower): string {
  const range = `${power.range || ""} ${power.attacks?.[0]?.range || ""}`.toLowerCase();
  if (/close|blast|burst|aura/.test(range)) return "C";
  if (/ranged|\brange\b|\barea\b/.test(range)) return "r";
  return "m";
}

function usageBucketTitle(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "Standard Actions";
  if (bucket === "minor") return "Minor Actions";
  if (bucket === "triggered") return "Triggered Actions";
  return "Other Actions";
}

function prettyOutcomeLabel(label: string): string {
  const map: Record<string, string> = {
    TRIGGER: "Trigger",
    REQUIREMENTS: "Requirements",
    TARGET: "Target",
    HIT: "Hit",
    MISS: "Miss",
    EFFECT: "Effect",
    AFTEREFFECT: "Aftereffect",
    SUSTAIN: "Sustain",
    "FAILED SAVE": "Failed Save",
    "NESTED ATTACK": "Nested Attack"
  };
  const upper = label.trim().toUpperCase();
  return map[upper] ?? label.charAt(0) + label.slice(1).toLowerCase();
}

function usageTitleParts(power: MonsterPower): string[] {
  const parts: string[] = [];
  const action = String(power.action ?? "").trim();
  const usage = String(power.usage ?? "").trim();
  if (isRenderableCardValue(action)) parts.push(action);
  if (isRenderableCardValue(usage)) parts.push(usage);
  return parts;
}

export type MonsterStatBlockCardProps = {
  monster: MonsterEntryFile;
  groupedPowers: Record<MonsterPowerActionBucket, MonsterPower[]>;
  displayedTraits: MonsterTrait[];
  displayedAuras: MonsterTrait[];
};

export function MonsterStatBlockCard(props: MonsterStatBlockCardProps): ReactElement {
  const { monster, groupedPowers, displayedTraits, displayedAuras } = props;
  const other = (monster.stats?.otherNumbers ?? {}) as Record<string, unknown>;
  const defenses = (monster.stats?.defenses ?? {}) as Record<string, unknown>;
  const skillsBlock = (monster.stats?.skills ?? {}) as Record<string, unknown>;

  const hp = pickScalar(other, ["hp", "hitPoints", "hit points", "Hit Points"]);
  const bloodied = pickScalar(other, ["bloodied", "Bloodied"]);
  const initiative = pickScalar(other, ["initiative", "Initiative"]);
  const perception = pickScalar(skillsBlock, ["perception", "Perception"]);
  const savingThrows = pickScalar(other, ["savingThrows", "saving throws", "Saving Throws"]);
  const actionPoints = pickScalar(other, ["actionPoints", "action points", "Action Points"]);

  const ac = pickScalar(defenses, ["ac", "AC"]);
  const fort = pickScalar(defenses, ["fortitude", "Fortitude"]);
  const reflex = pickScalar(defenses, ["reflex", "Reflex"]);
  const will = pickScalar(defenses, ["will", "Will"]);

  const abilities = readAbilityScores(monster);
  const orderA: Array<{ key: string; label: string }> = [
    { key: "str", label: "Str" },
    { key: "dex", label: "Dex" },
    { key: "wis", label: "Wis" },
    { key: "con", label: "Con" },
    { key: "int", label: "Int" },
    { key: "cha", label: "Cha" }
  ];

  const creatureTypeFormatted = formatMonsterCreatureTypeLine(monster);

  const sensesLine =
    Array.isArray(monster.senses) && monster.senses.length > 0
      ? monster.senses
          .map((s) => {
            const name = String(s.name ?? "").trim();
            const r = s.range !== undefined && s.range !== null && String(s.range).trim() !== "" ? ` ${String(s.range).trim()}` : "";
            return `${name}${r}`.trim();
          })
          .filter(Boolean)
          .join(", ")
      : "";

  const skillsSorted = Object.entries(skillsBlock)
    .filter(([k]) => !/perception/i.test(k))
    .map(([k, v]) => ({ name: k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "), value: String(v ?? "").trim() }))
    .filter((row) => row.name && row.value)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const skillsRow =
    skillsSorted.length > 0
      ? `Skills ${skillsSorted.map((s) => `${s.name} ${s.value}`).join(", ")}`
      : "";

  const movementLine = formatMovementLine(monster);
  const immuneLine =
    Array.isArray(monster.immunities) && monster.immunities.length > 0
      ? `Immune ${monster.immunities.join("; ")}`
      : "";
  const resistLine =
    Array.isArray(monster.resistances) && monster.resistances.length > 0
      ? `Resist ${monster.resistances.map((r) => resistWeakLine(r as Record<string, unknown>)).join(", ")}`
      : "";
  const vulnLine =
    Array.isArray(monster.weaknesses) && monster.weaknesses.length > 0
      ? `Vulnerable ${monster.weaknesses.map((w) => resistWeakLine(w as Record<string, unknown>)).join(", ")}`
      : "";

  const saveApParts: string[] = [];
  if (isRenderableCardValue(savingThrows)) saveApParts.push(`Saving Throws ${savingThrows}`);
  if (isRenderableCardValue(actionPoints)) saveApParts.push(`Action Points ${actionPoints}`);

  const headerSecondRowRight = `XP ${formatXp(monster.xp)}`;

  return (
    <aside aria-label="Monster stat block" style={cardShell}>
      <div style={{ fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.02em" }}>
        <span>
          {monster.name}
          {monster.alignment?.name ? ` (${monster.alignment.name})` : ""}
        </span>
        <span style={{ marginLeft: "0.65rem", fontWeight: 600 }}>
          Level {monster.level}
          {isRenderableCardValue(monster.groupRole) ? ` ${String(monster.groupRole).trim()}` : ""} {monster.role || ""}
        </span>
      </div>

      {creatureTypeFormatted ? (
        <div style={{ marginTop: "0.15rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
          <span style={{ flex: "1 1 12rem", minWidth: 0 }}>{creatureTypeFormatted}</span>
          <span style={{ whiteSpace: "nowrap", color: "var(--text-secondary)" }}>{headerSecondRowRight}</span>
        </div>
      ) : (
        <div style={{ marginTop: "0.15rem", color: "var(--text-secondary)", textAlign: "right" }}>{headerSecondRowRight}</div>
      )}

      {isRenderableCardValue(monster.parseError) ? (
        <div style={{ marginTop: "0.35rem", color: "var(--status-danger)", fontWeight: 600 }}>Parse error in source data.</div>
      ) : null}

      <div style={{ marginTop: "0.45rem", display: "grid", gap: "0.22rem" }}>
        {isRenderableCardValue(hp) ? (
          <div>
            HP {hp}
            {isRenderableCardValue(bloodied) ? `; Bloodied ${bloodied}` : ""}
          </div>
        ) : null}
        {(() => {
          const defParts: string[] = [];
          if (isRenderableCardValue(ac)) defParts.push(`AC ${ac}`);
          if (isRenderableCardValue(fort)) defParts.push(`Fortitude ${fort}`);
          if (isRenderableCardValue(reflex)) defParts.push(`Reflex ${reflex}`);
          if (isRenderableCardValue(will)) defParts.push(`Will ${will}`);
          return defParts.length > 0 ? <div>{defParts.join("; ")}</div> : null;
        })()}
        {movementLine ? <div>{movementLine}</div> : null}
        {monster.phasing ? <div>Phasing</div> : null}
        {(immuneLine || resistLine || vulnLine) && (
          <div>
            {[immuneLine, resistLine, vulnLine].filter(Boolean).join("; ")}
          </div>
        )}
        {saveApParts.length > 0 ? <div>{saveApParts.join("; ")}</div> : null}
        {isRenderableCardValue(initiative) ? <div>Initiative {initiative}</div> : null}
        {isRenderableCardValue(perception) ? <div>Perception {perception}</div> : null}
        {isRenderableCardValue(sensesLine) ? <div>{sensesLine}</div> : null}
      </div>

      {displayedAuras.length > 0 ? (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: "0.65rem" }}>Auras</div>
          <div style={{ display: "grid", gap: "0.28rem" }}>
            {displayedAuras.map((aura, idx) => (
              <div key={`aura-${idx}`}>
                <strong>{String(aura.name ?? "Aura").trim()}</strong>
                {aura.range !== undefined && aura.range !== null && String(aura.range).trim() !== ""
                  ? ` (range ${String(aura.range).trim()})`
                  : ""}
                {isRenderableCardValue(aura.details) ? `: ${String(aura.details).trim()}` : ""}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {displayedTraits.length > 0 ? (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: displayedAuras.length > 0 ? "0.55rem" : "0.65rem" }}>Traits</div>
          <div style={{ display: "grid", gap: "0.28rem" }}>
            {displayedTraits.map((trait, idx) => (
              <div key={`trait-${idx}`}>
                <strong>{String(trait.name ?? "Trait").trim()}</strong>
                {trait.range !== undefined && trait.range !== null && String(trait.range).trim() !== ""
                  ? ` (range ${String(trait.range).trim()})`
                  : ""}
                {isRenderableCardValue(trait.details) ? `: ${String(trait.details).trim()}` : ""}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {(["standard", "minor", "triggered", "other"] as const).map((bucket) => {
        const bucketPowers = groupedPowers[bucket];
        if (bucketPowers.length === 0) return null;
        return (
          <div key={bucket}>
            <div style={sectionHeaderStyle}>{usageBucketTitle(bucket)}</div>
            <div style={{ display: "grid", gap: "0.45rem" }}>
              {bucketPowers.map((power, index) => {
                const vm = buildMonsterPowerCardViewModel(power);
                const glyph = powerRangeGlyph(power);
                const kw =
                  vm.keywordTokens.length > 0 ? ` (${vm.keywordTokens.join(", ")})` : "";
                const usageChunk = usageTitleParts(power);
                const titleLine =
                  `${glyph} ${power.name || `Power ${index + 1}`}${kw}` +
                  (usageChunk.length ? ` • ${usageChunk.join(" • ")}` : "");

                return (
                  <div key={`${bucket}-${power.name}-${index}`} style={{ display: "grid", gap: "0.12rem" }}>
                    <div style={{ fontWeight: 700 }}>{titleLine}</div>
                    {vm.usageDetailsLines.map((line, li) => (
                      <div key={`ud-${li}`} style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>
                        {line}
                      </div>
                    ))}
                    {vm.attackLineParts.length > 0 ? (
                      <div>
                        <strong>Attack:</strong> {vm.attackLineParts.join("; ")}
                      </div>
                    ) : null}
                    {vm.outcomeLines.map((line) => (
                      <div key={`${line.label}-${line.text.slice(0, 48)}`}>
                        <strong>{prettyOutcomeLabel(line.label)}:</strong> {line.text}
                      </div>
                    ))}
                    {vm.secondaryAttacks.map((sec, si) => (
                      <div
                        key={`sec-${si}`}
                        style={{ marginLeft: "0.45rem", paddingLeft: "0.45rem", borderLeft: "2px solid var(--panel-border)" }}
                      >
                        <div style={{ fontWeight: 600 }}>{sec.name}</div>
                        {sec.attackLineParts.length > 0 ? (
                          <div>
                            <strong>Attack:</strong> {sec.attackLineParts.join("; ")}
                          </div>
                        ) : null}
                        {sec.outcomeLines.map((line) => (
                          <div key={`${sec.name}-${line.label}-${line.text.slice(0, 32)}`}>
                            <strong>{prettyOutcomeLabel(line.label)}:</strong> {line.text}
                          </div>
                        ))}
                      </div>
                    ))}
                    {isRenderableCardValue(vm.descriptionText) ? (
                      <div style={{ whiteSpace: "pre-wrap" }}>{vm.descriptionText}</div>
                    ) : null}
                    {isRenderableCardValue(vm.ongoingText) ? (
                      <div>
                        <strong>Ongoing:</strong> {vm.ongoingText}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {skillsRow ? <div style={{ marginTop: "0.55rem" }}>{skillsRow}</div> : null}

      <div
        style={{
          marginTop: "0.45rem",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "0.15rem 0.35rem",
          fontSize: "0.74rem"
        }}
      >
        {orderA.map(({ key }) => {
          const score = abilities[key];
          if (!Number.isFinite(score)) return <span key={key} />;
          return <span key={key}>{formatAbilityShort(key, score)}</span>;
        })}
      </div>

      <div style={{ marginTop: "0.45rem" }}>
        {monster.alignment?.name ? (
          <span>
            Alignment {monster.alignment.name}
            {Array.isArray(monster.languages) && monster.languages.length > 0 ? (
              <span style={{ marginLeft: "0.65rem" }}>Languages {monster.languages.join(", ")}</span>
            ) : null}
          </span>
        ) : Array.isArray(monster.languages) && monster.languages.length > 0 ? (
          <span>Languages {monster.languages.join(", ")}</span>
        ) : null}
      </div>

      {Array.isArray(monster.sourceBooks) && monster.sourceBooks.length > 0 ? (
        <div style={{ marginTop: "0.35rem", color: "var(--text-secondary)", fontSize: "0.72rem" }}>
          Monster found in {monster.sourceBooks.join(" and ")}
        </div>
      ) : null}
    </aside>
  );
}
