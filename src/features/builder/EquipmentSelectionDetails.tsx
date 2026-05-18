import type { CSSProperties } from "react";
import { RulesRichText } from "./RulesRichText";
import { hasMagicItemDescription, type MagicItemDescription } from "../../rules/equipmentDescriptions";

const panelStyle: CSSProperties = {
  display: "grid",
  gap: "0.4rem",
  padding: "0.5rem 0.6rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-0)"
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.78rem",
  fontWeight: 700,
  color: "var(--text-secondary)"
};

const subheadingStyle: CSSProperties = {
  margin: "0.2rem 0 0 0",
  fontSize: "0.74rem",
  fontWeight: 600,
  color: "var(--text-muted)"
};

const richTextProps = {
  paragraphStyle: { fontSize: "0.78rem", lineHeight: 1.45, margin: "0.15rem 0 0 0" } as CSSProperties,
  listItemStyle: { fontSize: "0.78rem", lineHeight: 1.45 } as CSSProperties
};

function MagicItemDescriptionBody({ description }: { description: MagicItemDescription }): JSX.Element {
  return (
    <>
      {description.flavor && <RulesRichText text={description.flavor} {...richTextProps} />}
      {description.enhancement && (
        <>
          <p style={subheadingStyle}>Enhancement</p>
          <RulesRichText text={description.enhancement} {...richTextProps} />
        </>
      )}
      {description.property && (
        <>
          <p style={subheadingStyle}>Property</p>
          <RulesRichText text={description.property} {...richTextProps} />
        </>
      )}
      {description.power && (
        <>
          <p style={subheadingStyle}>Power</p>
          <RulesRichText text={description.power} {...richTextProps} />
        </>
      )}
      {description.critical && (
        <>
          <p style={subheadingStyle}>Critical</p>
          <RulesRichText text={description.critical} {...richTextProps} />
        </>
      )}
      {description.requirement && (
        <>
          <p style={subheadingStyle}>Requirement</p>
          <RulesRichText text={description.requirement} {...richTextProps} />
        </>
      )}
    </>
  );
}

export interface EquipmentSelectionDetailsProps {
  baseName?: string;
  baseDescription?: string;
  enchantmentName?: string;
  enchantmentDescription?: MagicItemDescription;
}

export function EquipmentSelectionDetails({
  baseName,
  baseDescription,
  enchantmentName,
  enchantmentDescription
}: EquipmentSelectionDetailsProps): JSX.Element | null {
  const hasBase = Boolean(baseDescription?.trim());
  const hasEnchantment = hasMagicItemDescription(enchantmentDescription);
  if (!hasBase && !hasEnchantment) return null;

  return (
    <div style={panelStyle}>
      {hasBase && (
        <div>
          <p style={headingStyle}>{baseName ? `Item — ${baseName}` : "Item"}</p>
          <RulesRichText text={baseDescription!} {...richTextProps} />
        </div>
      )}
      {hasEnchantment && enchantmentDescription && (
        <div style={hasBase ? { paddingTop: "0.35rem", borderTop: "1px solid var(--panel-border)" } : undefined}>
          <p style={headingStyle}>{enchantmentName ? `Enchantment — ${enchantmentName}` : "Enchantment"}</p>
          <MagicItemDescriptionBody description={enchantmentDescription} />
        </div>
      )}
    </div>
  );
}
