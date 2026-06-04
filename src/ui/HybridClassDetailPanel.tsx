import type { CSSProperties } from "react";
import type { HybridClassDef } from "../rules/models";
import { CollapsibleDisclosure } from "./CollapsibleDisclosure";
import { disclosureSummaryStyle } from "./disclosureStyles";
import { RulesRichText } from "./RulesRichText";

function hybridRawSpecific(hybrid: HybridClassDef): Record<string, unknown> {
  return (hybrid.raw?.specific as Record<string, unknown> | undefined) || {};
}

function formatHybridStatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(x);
}

function hybridHpAt1Display(hybrid: HybridClassDef): string {
  const spec = hybridRawSpecific(hybrid);
  const hpAt1Raw = spec["Hit Points at 1st Level"];
  if (typeof hpAt1Raw === "string" && String(hpAt1Raw).trim()) return String(hpAt1Raw);
  return hybrid.hitPointsAt1 != null ? `${hybrid.hitPointsAt1} + Constitution score` : "—";
}

function hybridHpPerLevelDisplay(hybrid: HybridClassDef): string {
  const spec = hybridRawSpecific(hybrid);
  const hpPerRaw = spec["Hit Points per Level Gained"];
  if (typeof hpPerRaw === "string" && String(hpPerRaw).trim()) return String(hpPerRaw);
  return formatHybridStatNumber(hybrid.hitPointsPerLevel ?? null);
}

function hybridHealingSurgesDisplay(hybrid: HybridClassDef): string {
  const spec = hybridRawSpecific(hybrid);
  const surgesRaw = spec["Healing Surges"];
  if (typeof surgesRaw === "string" && String(surgesRaw).trim()) return String(surgesRaw);
  return formatHybridStatNumber(hybrid.healingSurgesBase ?? null);
}

const hoverRichTextParagraph = { margin: "0 0 0.25rem 0", fontSize: "0.76rem", color: "var(--text-primary)" };
const hoverRichTextListItem = { fontSize: "0.76rem", color: "var(--text-primary)" };

export function HybridClassDetailPanel(props: {
  hybrid: HybridClassDef;
  baseClassName: string | undefined;
  slotNote: string;
}): JSX.Element {
  const spec = hybridRawSpecific(props.hybrid);
  const h = props.hybrid;
  const trainedSkills = spec["Trained Skills"];
  const trainedDisplay = typeof trainedSkills === "string" && trainedSkills.trim() ? trainedSkills : null;
  const body = typeof h.raw?.body === "string" ? h.raw.body : "";

  return (
    <div
      style={{
        border: "1px solid var(--panel-border)",
        borderRadius: "8px",
        padding: "0.65rem 0.75rem",
        backgroundColor: "var(--surface-1)"
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{h.name}</p>
      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        {h.source ? `Source: ${h.source} · ` : ""}
        {props.slotNote}
      </p>
      <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Base class (powers):</strong> {props.baseClassName ?? "—"}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Role:</strong> {String(h.role || spec["Role"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Power Source:</strong> {String(h.powerSource || spec["Power Source"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Key Abilities:</strong> {String(h.keyAbilities || spec["Key Abilities"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Hit Points at 1st Level:</strong> {hybridHpAt1Display(h)}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Hit Points per Level Gained:</strong> {hybridHpPerLevelDisplay(h)}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Healing Surges (without Con):</strong> {hybridHealingSurgesDisplay(h)}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Bonus to Defense:</strong> {String(h.bonusToDefense || spec["Bonus to Defense"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Armor Proficiencies:</strong> {String(h.armorProficiencies || spec["Armor Proficiencies"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Weapon Proficiencies:</strong> {String(h.weaponProficiencies || spec["Weapon Proficiencies"] || "-")}
      </p>
      <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Implements:</strong> {String(h.implementText || spec["Implements"] || spec["Implement"] || "-")}
      </p>
      <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
        <strong>Class Skills:</strong> {String(h.classSkillsRaw || spec["Class Skills"] || "—")}
      </p>
      {trainedDisplay && (
        <p style={{ margin: "0.28rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.5 }}>
          <strong>Trained Skills (text):</strong> {trainedDisplay}
        </p>
      )}
      {h.hybridTalentOptions &&
      String(h.hybridTalentOptions).trim() &&
      !(h.hybridTalentClassFeatures && h.hybridTalentClassFeatures.length > 0) ? (
        <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.84rem", lineHeight: 1.45 }}>
          <strong>Hybrid Talent Options:</strong> {String(h.hybridTalentOptions)}
        </p>
      ) : null}
      {spec["Build Options"] ? (
        <CollapsibleDisclosure
          open
          style={{ marginTop: "0.45rem" }}
          summary="Build Options"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}
        >
          <RulesRichText
            text={String(spec["Build Options"])}
            paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
            listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
          />
        </CollapsibleDisclosure>
      ) : null}
      {body ? (
        <CollapsibleDisclosure
          open
          style={{ marginTop: "0.45rem" }}
          summary="Description"
          summaryStyle={disclosureSummaryStyle}
          bodyStyle={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}
        >
          <RulesRichText
            text={body}
            paragraphStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
            listItemStyle={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}
          />
        </CollapsibleDisclosure>
      ) : null}
    </div>
  );
}

/** Compact hybrid block for character sheet hover panels (matches single-class info rows). */
export function HybridClassHoverDetail(props: {
  hybrid: HybridClassDef;
  baseClassName: string | undefined;
  sectionTitle?: string;
  style?: CSSProperties;
}): JSX.Element {
  const spec = hybridRawSpecific(props.hybrid);
  const h = props.hybrid;
  const body = typeof h.raw?.body === "string" && h.raw.body.trim() ? h.raw.body : "";

  return (
    <div style={props.style}>
      {props.sectionTitle ? (
        <div style={{ marginBottom: "0.35rem", fontWeight: 700, fontSize: "0.8rem", color: "var(--text-primary)" }}>
          {props.sectionTitle}
        </div>
      ) : null}
      <div>
        <strong>Hybrid class:</strong> {h.name}
      </div>
      <div>
        <strong>Base class (powers):</strong> {props.baseClassName ?? "—"}
      </div>
      <div>
        <strong>Role:</strong> {String(h.role || spec["Role"] || "-")}
      </div>
      <div>
        <strong>Power Source:</strong> {String(h.powerSource || spec["Power Source"] || "-")}
      </div>
      <div>
        <strong>Key Abilities:</strong> {String(h.keyAbilities || spec["Key Abilities"] || "-")}
      </div>
      <div>
        <strong>HP at 1:</strong> {hybridHpAt1Display(h)}
      </div>
      <div>
        <strong>HP per Level:</strong> {hybridHpPerLevelDisplay(h)}
      </div>
      <div>
        <strong>Healing Surges:</strong> {hybridHealingSurgesDisplay(h)}
      </div>
      <div>
        <strong>Bonus to Defense:</strong> {String(h.bonusToDefense || spec["Bonus to Defense"] || "-")}
      </div>
      {body ? (
        <div style={{ marginTop: "0.3rem" }}>
          <RulesRichText text={body} paragraphStyle={hoverRichTextParagraph} listItemStyle={hoverRichTextListItem} />
        </div>
      ) : null}
    </div>
  );
}
