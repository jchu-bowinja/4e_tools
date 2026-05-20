import type { CSSProperties } from "react";
import type { MonsterEntryFile } from "./storage";
import { findSuspiciousWeaknesses, readMonsterImportWarnings } from "./monsterDataQuality";

const bannerStyle: CSSProperties = {
  marginBottom: "0.55rem",
  padding: "0.4rem 0.55rem",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  border: "1px solid var(--panel-border)",
  backgroundColor: "var(--surface-1)",
  fontSize: "0.78rem",
  lineHeight: 1.45
};

export function MonsterDataQualityAlerts({ entry }: { entry: MonsterEntryFile | null }): JSX.Element | null {
  if (!entry) return null;

  const importWarnings = readMonsterImportWarnings(entry.sections);
  const suspiciousWeaknesses = findSuspiciousWeaknesses(entry.weaknesses);

  if (importWarnings.length === 0 && suspiciousWeaknesses.length === 0) return null;

  return (
    <>
      {importWarnings.length > 0 ? (
        <div role="status" style={{ ...bannerStyle, color: "var(--status-warning, var(--text-secondary))" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Import warnings</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {importWarnings.map((warning, index) => (
              <li key={`import-warning-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {suspiciousWeaknesses.length > 0 ? (
        <div role="status" style={{ ...bannerStyle, color: "var(--status-danger)" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Suspicious weakness entries</div>
          <p style={{ margin: "0 0 0.25rem 0", color: "var(--text-secondary)" }}>
            These rows may be ETL fragments (e.g. split from “vulnerable against …”). Review in JSON or re-import.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {suspiciousWeaknesses.map(({ index, label }) => (
              <li key={`weakness-suspicious-${index}`}>
                <code style={{ fontSize: "0.92em" }}>weaknesses[{index}]</code>: {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
