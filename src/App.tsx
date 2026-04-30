import { useEffect, useMemo, useState } from "react";
import { loadRulesIndex } from "./data/loadRules";
import { RulesIndex } from "./rules/models";
import { CharacterBuilderApp } from "./features/builder/CharacterBuilderApp";
import { appLoadingCard, appLoadingShell } from "./ui/tokens";
import { mergeRulesOverlay, type ResourceEditorOverlay } from "./features/resourceEditor/overlay";
import {
  loadResourceEditorOverlay,
  resetResourceEditorOverlay,
  saveResourceEditorOverlay
} from "./features/resourceEditor/storage";
import { ResourceEditorApp } from "./features/resourceEditor/ResourceEditorApp";
import { CharacterSheetApp } from "./features/characterSheet/CharacterSheetApp";
import { MonsterEditorApp } from "./features/monsterEditor/MonsterEditorApp";
import { GlossaryEditorApp } from "./features/glossaryEditor/GlossaryEditorApp";
import { glossaryRowsToTooltipMap, type GlossaryTermRow } from "./data/tooltipGlossary";
import { loadInitialGlossaryRows, reloadGlossaryRowsFromBundle } from "./data/loadGlossaryRows";

type AppScreen = "builder" | "resourceEditor" | "characterSheet" | "monsters" | "glossary";
type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "dnd4e.app.theme";

const SCREEN_HASH: Record<AppScreen, string> = {
  builder: "#/builder",
  resourceEditor: "#/resource-editor",
  characterSheet: "#/character-sheet",
  monsters: "#/monsters",
  glossary: "#/glossary"
};

function screenFromHash(hash: string): AppScreen {
  const normalized = hash.trim().toLowerCase();
  if (normalized === "#/resource-editor") return "resourceEditor";
  if (normalized === "#/character-sheet") return "characterSheet";
  if (normalized === "#/monsters") return "monsters";
  if (normalized === "#/glossary") return "glossary";
  return "builder";
}

function loadSavedTheme(): AppTheme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

const THEME_COLORS: Record<
  AppTheme,
  {
    appBackground: string;
    headerBackground: string;
    headerBorder: string;
    text: string;
    mutedText: string;
    errorText: string;
    toggleBackground: string;
    toggleBorder: string;
  }
> = {
  light: {
    appBackground: "#e4e5e9",
    headerBackground: "#f8fafc",
    headerBorder: "#d1d5db",
    text: "#111827",
    mutedText: "#3a3a42",
    errorText: "crimson",
    toggleBackground: "#ffffff",
    toggleBorder: "#cbd5e1"
  },
  dark: {
    appBackground: "#111827",
    headerBackground: "#0f172a",
    headerBorder: "#334155",
    text: "#e5e7eb",
    mutedText: "#cbd5e1",
    errorText: "#fda4af",
    toggleBackground: "#1f2937",
    toggleBorder: "#475569"
  }
};

export default function App(): JSX.Element {
  const [index, setIndex] = useState<RulesIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<AppScreen>(() => screenFromHash(window.location.hash));
  const [editorOverlay, setEditorOverlay] = useState<ResourceEditorOverlay>(() => loadResourceEditorOverlay());
  const [theme, setTheme] = useState<AppTheme>(() => loadSavedTheme());
  const [glossaryRows, setGlossaryRows] = useState<GlossaryTermRow[] | null>(null);

  const tooltipGlossary = useMemo(
    () => (glossaryRows == null ? {} : glossaryRowsToTooltipMap(glossaryRows)),
    [glossaryRows]
  );

  useEffect(() => {
    loadRulesIndex()
      .then(setIndex)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"));
  }, []);

  useEffect(() => {
    loadInitialGlossaryRows()
      .then(setGlossaryRows)
      .catch(() => setGlossaryRows([]));
  }, []);

  useEffect(() => {
    function handleHashChange(): void {
      setScreen(screenFromHash(window.location.hash));
    }
    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) {
      window.location.hash = SCREEN_HASH.builder;
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function goToScreen(nextScreen: AppScreen): void {
    setScreen(nextScreen);
    window.location.hash = SCREEN_HASH[nextScreen];
  }

  function handleSaveOverlay(nextOverlay: ResourceEditorOverlay): void {
    saveResourceEditorOverlay(nextOverlay);
    setEditorOverlay(nextOverlay);
  }

  function handleResetOverlay(): void {
    setEditorOverlay(resetResourceEditorOverlay());
  }

  const colors = THEME_COLORS[theme];

  if (error) {
    return (
      <pre role="alert" style={{ padding: "1rem", color: colors.errorText }}>
        {error}
      </pre>
    );
  }
  if (!index) {
    return (
      <div style={{ ...appLoadingShell, backgroundColor: colors.appBackground, color: colors.text }}>
        <div
          role="status"
          aria-live="polite"
          style={{
            ...appLoadingCard,
            backgroundColor: colors.toggleBackground,
            borderColor: colors.toggleBorder,
            color: colors.mutedText
          }}
        >
          Loading rules index…
        </div>
      </div>
    );
  }

  const effectiveIndex = mergeRulesOverlay(index, editorOverlay);

  async function handleGlossaryResetToBundled(): Promise<void> {
    const next = await reloadGlossaryRowsFromBundle();
    setGlossaryRows(next);
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.appBackground, color: colors.text }}>
      <a href="#app-main-content" className="skip-link">
        Skip to main content
      </a>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "0.65rem 1rem",
          borderBottom: `1px solid ${colors.headerBorder}`,
          backgroundColor: colors.headerBackground,
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <strong style={{ letterSpacing: "0.02em" }}>4E Builder Tools</strong>
        <nav
          aria-label="Primary"
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "nowrap",
            maxWidth: "100%",
            overflowX: "auto",
            paddingBottom: "0.1rem"
          }}
        >
          <button type="button" aria-current={screen === "builder" ? "page" : undefined} onClick={() => goToScreen("builder")} disabled={screen === "builder"}>
            Character Builder
          </button>
          <button type="button" aria-current={screen === "characterSheet" ? "page" : undefined} onClick={() => goToScreen("characterSheet")} disabled={screen === "characterSheet"}>
            Character Sheet
          </button>
          <button type="button" aria-current={screen === "monsters" ? "page" : undefined} onClick={() => goToScreen("monsters")} disabled={screen === "monsters"}>
            Monsters
          </button>
          <button type="button" aria-current={screen === "glossary" ? "page" : undefined} onClick={() => goToScreen("glossary")} disabled={screen === "glossary"}>
            Glossary
          </button>
          <button type="button" aria-current={screen === "resourceEditor" ? "page" : undefined} onClick={() => goToScreen("resourceEditor")} disabled={screen === "resourceEditor"}>
            Resource Editor
          </button>
          <button
            type="button"
            aria-label="Toggle dark mode"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            style={{
              backgroundColor: colors.toggleBackground,
              borderColor: colors.toggleBorder,
              color: colors.text
            }}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </nav>
      </header>
      <main id="app-main-content" tabIndex={-1}>
        {screen === "builder" ? (
          <CharacterBuilderApp index={effectiveIndex} tooltipGlossary={tooltipGlossary} />
        ) : screen === "resourceEditor" ? (
          <ResourceEditorApp
            index={effectiveIndex}
            overlay={editorOverlay}
            onSaveOverlay={handleSaveOverlay}
            onResetOverlay={handleResetOverlay}
          />
        ) : screen === "characterSheet" ? (
          <CharacterSheetApp index={effectiveIndex} tooltipGlossary={tooltipGlossary} />
        ) : screen === "monsters" ? (
          <MonsterEditorApp index={effectiveIndex} tooltipGlossary={tooltipGlossary} />
        ) : screen === "glossary" && glossaryRows != null ? (
          <GlossaryEditorApp rows={glossaryRows} onRowsChange={setGlossaryRows} onResetToBundled={handleGlossaryResetToBundled} />
        ) : screen === "glossary" ? (
          <div style={{ padding: "1.25rem", color: "var(--text-muted, inherit)" }}>Loading glossary…</div>
        ) : (
          <CharacterBuilderApp index={effectiveIndex} tooltipGlossary={tooltipGlossary} />
        )}
      </main>
    </div>
  );
}

