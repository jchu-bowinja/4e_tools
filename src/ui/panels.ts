import type { CSSProperties } from "react";

/** Bordered content panel shell; add padding at the call site or use `contentPanelPaddedStyle`. */
export const contentPanelStyle: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  boxShadow: "var(--ui-panel-shadow, 0 1px 2px rgba(40, 30, 10, 0.08))"
};

/** Standard inset padding for sheet-style panels. */
export const contentPanelPaddedStyle: CSSProperties = {
  ...contentPanelStyle,
  padding: "0.55rem"
};

export const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

/** Page titles with space before the tab bar (monster editor). */
export const pageTitleWithBottomGapStyle: CSSProperties = {
  ...pageTitleStyle,
  marginTop: 0,
  marginBottom: "0.35rem"
};

/** Section headings inside sheet / monster panels. */
export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.9rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

/** Main-column tab headings in the character builder. */
export const builderSectionTitleStyle: CSSProperties = {
  margin: "0 0 0.6rem 0",
  fontSize: "0.9rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-primary)"
};

/** Subsection inside a bordered panel — no second panel chrome (UI bible). */
export const flowSubsectionStyle: CSSProperties = {
  marginBottom: "0.65rem",
  minWidth: 0
};

/** Glossary / Resource editor page shell (neutral, not sheet gradient). */
export const editorPageShellStyle: CSSProperties = {
  maxWidth: 1360,
  margin: "0 auto",
  padding: "clamp(0.75rem, 1.5vw, 1.15rem)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
  minHeight: "100%"
};

export const editorPageIntroStyle: CSSProperties = {
  marginTop: 0,
  color: "var(--text-muted)"
};

export const editorFieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.78rem",
  color: "var(--text-muted)",
  marginBottom: "0.2rem"
};

export const editorFieldSurfaceStyle: CSSProperties = {
  backgroundColor: "var(--surface-0)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--control-radius, 6px)"
};

export const editorPanelHeaderStyle: CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--panel-border)",
  fontWeight: 600
};

export const editorStatusBannerStyle: CSSProperties = {
  marginBottom: "0.75rem",
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--panel-border)",
  fontSize: "0.9rem"
};

export const editorInsetPreviewStyle: CSSProperties = {
  padding: "0.55rem 0.65rem",
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--ui-panel-radius, 0.35rem)",
  fontSize: "0.88rem"
};

/** Parchment gradient shell shared by builder, character sheet, and monster editor. */
export const rulesPageShellStyle: CSSProperties = {
  maxWidth: "1440px",
  margin: "0 auto",
  boxSizing: "border-box",
  fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  background: "var(--character-sheet-background, linear-gradient(180deg, var(--surface-1) 0%, var(--surface-1) 100%))",
  color: "var(--character-sheet-foreground, var(--text-primary))"
};

/** Sticky tab bar on rules pages — matches `rulesPageShellStyle` background. */
export const rulesStickyTabBarStyle: CSSProperties = {
  position: "sticky",
  top: "var(--app-header-sticky-offset, 3.25rem)",
  zIndex: 15,
  background: "var(--character-sheet-background, linear-gradient(180deg, var(--surface-1) 0%, var(--surface-1) 100%))",
  paddingTop: "0.65rem",
  paddingBottom: "0.65rem",
  borderBottom: "1px solid var(--panel-border)",
  boxShadow: "0 4px 12px color-mix(in srgb, var(--surface-2) 88%, transparent)",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box"
};
