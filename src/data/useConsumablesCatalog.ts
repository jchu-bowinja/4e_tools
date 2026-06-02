import { useEffect, useState } from "react";
import type { RulesIndex } from "../rules/models";
import {
  consumablesCatalogNeedsFetch,
  getConsumablesFromIndex,
  resolveConsumablesCatalog,
  type ConsumablesCatalog
} from "./loadConsumablesCatalog";

const EMPTY_CATALOG: ConsumablesCatalog = {
  adventuringGear: [],
  rituals: [],
  martialPractices: [],
  alchemyItems: []
};

export function useConsumablesCatalog(index: RulesIndex | null): {
  catalog: ConsumablesCatalog;
  loading: boolean;
  catalogMissing: boolean;
} {
  const [catalog, setCatalog] = useState<ConsumablesCatalog>(() =>
    index ? getConsumablesFromIndex(index) : EMPTY_CATALOG
  );
  const [loading, setLoading] = useState(() => (index ? consumablesCatalogNeedsFetch(index) : false));
  const [catalogMissing, setCatalogMissing] = useState(false);

  useEffect(() => {
    if (!index) {
      setCatalog(EMPTY_CATALOG);
      setLoading(false);
      setCatalogMissing(false);
      return;
    }

    if (!consumablesCatalogNeedsFetch(index)) {
      setCatalog(getConsumablesFromIndex(index));
      setLoading(false);
      setCatalogMissing(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    resolveConsumablesCatalog(index).then((resolved) => {
      if (cancelled) return;
      setCatalog(resolved);
      setLoading(false);
      setCatalogMissing(
        resolved.adventuringGear.length === 0 &&
          resolved.rituals.length === 0 &&
          resolved.martialPractices.length === 0 &&
          resolved.alchemyItems.length === 0
      );
    });

    return () => {
      cancelled = true;
    };
  }, [index]);

  return { catalog, loading, catalogMissing };
}
