import type { CSSProperties } from "react";
import type { PowerCardUsageBucket } from "./types";

export type PowerCardAccentStyle = {
  border: string;
  borderLeft: string;
  backgroundColor: string;
};

export function powerCardUsageBucketFromLabel(usageRaw: string): PowerCardUsageBucket | null {
  const u = usageRaw.toLowerCase();
  if (u.includes("at-will") || u.includes("at will")) return "atWill";
  if (u.includes("encounter")) return "encounter";
  if (u.includes("daily")) return "daily";
  return null;
}

export function powerCardUsageAccentFromLabel(usageRaw: string): PowerCardAccentStyle {
  const u = usageRaw.toLowerCase();
  if (u.includes("at-will") || u.includes("at will")) {
    return powerCardUsageAccentStyle("atWill");
  }
  if (u.includes("encounter")) {
    return powerCardUsageAccentStyle("encounter");
  }
  if (u.includes("daily")) {
    return powerCardUsageAccentStyle("daily");
  }
  return powerCardUsageAccentStyle("utility");
}

export function powerCardUsageAccentStyle(bucket: PowerCardUsageBucket): PowerCardAccentStyle {
  if (bucket === "atWill") {
    return {
      border: "1px solid var(--power-accent-atwill-border)",
      borderLeft: "6px solid var(--power-accent-atwill-bar)",
      backgroundColor: "var(--power-accent-atwill-bg)"
    };
  }
  if (bucket === "encounter") {
    return {
      border: "1px solid var(--power-accent-encounter-border)",
      borderLeft: "6px solid var(--power-accent-encounter-bar)",
      backgroundColor: "var(--power-accent-encounter-bg)"
    };
  }
  if (bucket === "daily") {
    return {
      border: "1px solid var(--power-accent-daily-border)",
      borderLeft: "6px solid var(--power-accent-daily-bar)",
      backgroundColor: "var(--power-accent-daily-bg)"
    };
  }
  return {
    border: "1px solid var(--panel-border)",
    borderLeft: "6px solid var(--text-secondary)",
    backgroundColor: bucket === "utility" ? "var(--surface-1)" : "var(--surface-0)"
  };
}

export function powerCardUsageAccentBarColor(bucket: PowerCardUsageBucket): string {
  if (bucket === "atWill") return "var(--power-accent-atwill-bar)";
  if (bucket === "encounter") return "var(--power-accent-encounter-bar)";
  if (bucket === "daily") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

export type MonsterPowerActionBucket = "standard" | "move" | "minor" | "free" | "triggered" | "other";

export function monsterPowerActionAccentBarColor(bucket: MonsterPowerActionBucket): string {
  if (bucket === "standard") return "var(--power-accent-atwill-bar)";
  if (bucket === "move") return "var(--power-accent-move-bar)";
  if (bucket === "minor") return "var(--power-accent-encounter-bar)";
  if (bucket === "free") return "var(--power-accent-free-bar)";
  if (bucket === "triggered") return "var(--power-accent-daily-bar)";
  return "var(--text-secondary)";
}

export function monsterPowerActionAccentStyle(bucket: MonsterPowerActionBucket): PowerCardAccentStyle {
  if (bucket === "standard") {
    return powerCardUsageAccentStyle("atWill");
  }
  if (bucket === "move") {
    return {
      border: "1px solid var(--power-accent-move-border)",
      borderLeft: "6px solid var(--power-accent-move-bar)",
      backgroundColor: "var(--power-accent-move-bg)"
    };
  }
  if (bucket === "minor") {
    return powerCardUsageAccentStyle("encounter");
  }
  if (bucket === "free") {
    return {
      border: "1px solid var(--power-accent-free-border)",
      borderLeft: "6px solid var(--power-accent-free-bar)",
      backgroundColor: "var(--power-accent-free-bg)"
    };
  }
  if (bucket === "triggered") {
    return powerCardUsageAccentStyle("daily");
  }
  return powerCardUsageAccentStyle("utility");
}

export function monsterPowerCardShellStyle(
  bucket: MonsterPowerActionBucket,
  options?: { beveled?: boolean; height?: CSSProperties["height"] }
): CSSProperties {
  const accent = monsterPowerActionAccentStyle(bucket);
  const bar = monsterPowerActionAccentBarColor(bucket);
  const style: CSSProperties = {
    border: accent.border,
    borderLeft: accent.borderLeft,
    borderRadius: "8px",
    padding: 0,
    backgroundColor: accent.backgroundColor,
    height: options?.height ?? "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  };
  if (options?.beveled !== false) {
    style.boxShadow = [
      `inset 0 0 0 1px color-mix(in srgb, ${bar} 40%, transparent)`,
      "inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent)",
      "inset 0 -1px 0 color-mix(in srgb, var(--text-primary) 7%, transparent)",
      "0 2px 6px color-mix(in srgb, var(--text-primary) 7%, transparent)"
    ].join(", ");
  }
  return style;
}
