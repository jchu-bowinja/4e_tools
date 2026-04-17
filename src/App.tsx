import { useEffect, useState } from "react";
import { loadRulesIndex } from "./data/loadRules";
import { RulesIndex } from "./rules/models";
import { CharacterBuilderApp } from "./features/builder/CharacterBuilderApp";
import { appLoadingCard, appLoadingShell } from "./ui/tokens";

export default function App(): JSX.Element {
  const [index, setIndex] = useState<RulesIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRulesIndex()
      .then(setIndex)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"));
  }, []);

  if (error) {
    return <pre style={{ padding: "1rem", color: "crimson" }}>{error}</pre>;
  }
  if (!index) {
    return (
      <div style={appLoadingShell}>
        <div style={appLoadingCard}>Loading rules index…</div>
      </div>
    );
  }

  return <CharacterBuilderApp index={index} />;
}

