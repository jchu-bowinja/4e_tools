import type { CSSProperties, ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { PowerFeatModifications } from "../../rules/featPowerModifications";
import type { Power } from "../../rules/models";
import { buildCharacterPowerCardViewModel } from "./characterPowerCardViewModel";
import { powerCardUsageAccentBarColor, powerCardUsageAccentStyle } from "./powerCardAccent";
import type { CharacterPowerCardLabeledLine, CharacterPowerCardViewModel, PowerCardUsageBucket } from "./types";

export type CharacterPowerCardProps = {
  power?: Power;
  vm?: CharacterPowerCardViewModel;
  featMods?: PowerFeatModifications;
  variant?: "builder" | "sheet";
  as?: ElementType;
  renderLineText?: (text: string, segmentKey: string, line: CharacterPowerCardLabeledLine) => ReactNode;
  renderKeyword?: (keyword: string, index: number) => ReactNode;
  renderUsageInHeader?: (usageLabel: string, usageBucket: PowerCardUsageBucket) => ReactNode;
  renderBody?: (body: string) => ReactNode;
  renderAugmentationText?: (text: string, featId: string) => ReactNode;
  expended?: boolean;
  showExpendedBadge?: boolean;
  footer?: ReactNode;
  showInsetShadow?: boolean;
  shellStyle?: CSSProperties;
  marginTop?: string;
} & Omit<ComponentPropsWithoutRef<"article">, "style" | "children">;

function defaultRenderKeyword(keyword: string): ReactNode {
  return <span style={{ color: "var(--text-primary)" }}>{keyword}</span>;
}

function CharacterPowerCardLabeledBlock({
  lines,
  renderLineText,
  fontSize,
  color
}: {
  lines: CharacterPowerCardViewModel["preAttackLines"];
  renderLineText: (text: string, segmentKey: string, line: CharacterPowerCardLabeledLine) => ReactNode;
  fontSize: string;
  color: string;
}): JSX.Element | null {
  if (lines.length === 0) return null;
  return (
    <div style={{ marginTop: "0.3rem", fontSize, color, lineHeight: 1.45 }}>
      {lines.map((line) => (
        <div key={line.segmentKey}>
          <strong>{line.label}:</strong> {renderLineText(line.text, line.segmentKey, line)}
        </div>
      ))}
    </div>
  );
}

export function CharacterPowerCard({
  power,
  vm: vmProp,
  featMods,
  variant = "builder",
  as: Root = "article",
  renderLineText,
  renderKeyword,
  renderUsageInHeader,
  renderBody,
  renderAugmentationText,
  expended = false,
  showExpendedBadge = false,
  footer,
  showInsetShadow = false,
  shellStyle,
  marginTop,
  className,
  style,
  ...rootProps
}: CharacterPowerCardProps): JSX.Element {
  const vm = vmProp ?? (power ? buildCharacterPowerCardViewModel(power, featMods) : null);
  if (!vm) {
    throw new Error("CharacterPowerCard requires `power` or `vm`.");
  }

  const accent = powerCardUsageAccentStyle(vm.usageBucket);
  const secondaryFontSize = variant === "sheet" ? "0.82rem" : "0.78rem";
  const metaFontSize = variant === "sheet" ? "0.85rem" : "0.78rem";
  const bodyFontSize = variant === "sheet" ? "0.8rem" : "0.78rem";
  const bodyColor = variant === "sheet" ? "var(--text-primary)" : "var(--text-muted)";
  const keywordFontSize = variant === "sheet" ? "0.82rem" : "0.77rem";
  const keywordColor = variant === "sheet" ? "var(--text-secondary)" : "var(--text-muted)";
  const renderText =
    renderLineText ?? ((text: string) => text);
  const renderKw = renderKeyword ?? defaultRenderKeyword;

  const rootStyle: CSSProperties = {
    border: accent.border,
    borderLeft: accent.borderLeft,
    backgroundColor: accent.backgroundColor,
    borderRadius: "8px",
    padding: "0.55rem 0.65rem",
    marginTop: marginTop ?? (variant === "builder" ? "0.45rem" : undefined),
    ...(showInsetShadow
      ? { boxShadow: `inset 0 0 0 1px ${powerCardUsageAccentBarColor(vm.usageBucket)}33` }
      : {}),
    ...(variant === "sheet"
      ? {
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }
      : {}),
    ...shellStyle,
    ...style
  };

  return (
    <Root className={className} style={rootStyle} {...rootProps}>
      {variant === "sheet" ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <strong style={{ textDecoration: expended ? "line-through" : "none" }}>{vm.name}</strong>
          <span style={{ fontSize: metaFontSize, color: "var(--text-secondary)" }}>
            Lv {vm.level ?? 0} • {vm.usageLabel}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{vm.name}</div>
          <div style={{ fontSize: metaFontSize, color: "var(--text-muted)" }}>
            {renderUsageInHeader ? (
              renderUsageInHeader(vm.usageLabel, vm.usageBucket)
            ) : (
              vm.usageLabel
            )}
            {vm.powerType !== "-" ? ` • ${vm.powerType}` : ""}
            {vm.level != null && vm.level > 0 ? ` • Lv ${vm.level}` : ""}
          </div>
        </div>
      )}

      {showExpendedBadge && expended ? (
        <div
          style={{
            marginTop: "0.28rem",
            alignSelf: "flex-start",
            padding: "0.12rem 0.45rem",
            borderRadius: "999px",
            backgroundColor: "var(--status-danger)",
            color: "#ffffff",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          Used
        </div>
      ) : null}

      {vm.display ? (
        <div style={{ fontSize: secondaryFontSize, color: "var(--text-secondary)", marginTop: "0.2rem" }}>{vm.display}</div>
      ) : null}

      {vm.keywords.length > 0 ? (
        <div style={{ fontSize: keywordFontSize, color: keywordColor, marginTop: "0.2rem" }}>
          <strong>Keywords:</strong>{" "}
          {vm.keywords.map((keyword, idx) => (
            <span key={`${vm.id}-kw-${keyword}`}>
              {renderKw(keyword, idx)}
              {idx < vm.keywords.length - 1 ? <span> </span> : null}
            </span>
          ))}
        </div>
      ) : null}

      <CharacterPowerCardLabeledBlock
        lines={vm.preAttackLines}
        renderLineText={renderText}
        fontSize={bodyFontSize}
        color={bodyColor}
      />
      <CharacterPowerCardLabeledBlock
        lines={vm.outcomeLines}
        renderLineText={renderText}
        fontSize={bodyFontSize}
        color={bodyColor}
      />

      {vm.augmentationLines.length > 0 ? (
        <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {vm.augmentationLines.map((aug) => (
            <div
              key={`${vm.id}-aug-${aug.featId}`}
              style={{
                padding: "0.35rem 0.45rem",
                borderRadius: "6px",
                borderLeft: "3px solid var(--status-info)",
                backgroundColor: "color-mix(in srgb, var(--status-info) 10%, var(--surface-1))"
              }}
            >
              <div
                style={{
                  fontSize: keywordFontSize,
                  fontWeight: 600,
                  color: "var(--status-info)",
                  marginBottom: "0.15rem"
                }}
              >
                {aug.featName}
              </div>
              <div style={{ fontSize: bodyFontSize, color: bodyColor, lineHeight: 1.45 }}>
                {renderAugmentationText ? renderAugmentationText(aug.text, aug.featId) : aug.text}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {vm.body ? (
        <div style={{ marginTop: "0.35rem", fontSize: bodyFontSize, color: bodyColor }}>
          {renderBody ? renderBody(vm.body) : vm.body}
        </div>
      ) : null}

      {variant === "sheet" && (vm.flavor || footer) ? (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "0.35rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "0.5rem"
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {vm.flavor ? (
              <p style={{ margin: 0, fontStyle: "italic", fontSize: bodyFontSize, color: "var(--text-secondary)" }}>{vm.flavor}</p>
            ) : null}
          </div>
          {footer}
        </div>
      ) : (
        <>
          {vm.flavor ? (
            <p style={{ margin: "0.35rem 0 0 0", fontStyle: "italic", fontSize: bodyFontSize, color: "var(--text-muted)" }}>
              {vm.flavor}
            </p>
          ) : null}
          {footer}
        </>
      )}
    </Root>
  );
}
