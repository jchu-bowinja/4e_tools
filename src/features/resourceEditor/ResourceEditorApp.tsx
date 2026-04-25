import { useMemo, useState } from "react";
import type { RulesIndex } from "../../rules/models";
import {
  EDITABLE_RESOURCE_COLLECTIONS,
  emptyResourceEditorOverlay,
  normalizeResourceEditorOverlay,
  type EditableResourceCollection,
  type ResourceCollectionOverlay,
  type ResourceEditorOverlay
} from "./overlay";
import { StructuredFieldGrid, type FieldDef } from "./components/StructuredFieldGrid";
import { getReferentialWarnings } from "./components/referentialWarnings";

interface Props {
  index: RulesIndex;
  overlay: ResourceEditorOverlay;
  onSaveOverlay: (overlay: ResourceEditorOverlay) => void;
  onResetOverlay: () => void;
}

const LABELS: Record<EditableResourceCollection, string> = {
  races: "Races",
  classes: "Classes",
  powers: "Powers",
  feats: "Feats",
  themes: "Themes",
  paragonPaths: "Paragon Paths",
  epicDestinies: "Epic Destinies",
  racialTraits: "Racial Traits",
  hybridClasses: "Hybrid Classes",
  armors: "Armors",
  weapons: "Weapons",
  implements: "Implements"
};

const COMMON_FIELDS: FieldDef[] = [
  { key: "id", label: "ID", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "slug", label: "Slug", type: "text" }
];

const COLLECTION_FIELDS: Record<EditableResourceCollection, FieldDef[]> = {
  races: [
    { key: "speed", label: "Speed", type: "number" },
    { key: "size", label: "Size", type: "text" },
    { key: "abilitySummary", label: "Ability Summary", type: "text" },
    { key: "languages", label: "Languages", type: "text" }
  ],
  classes: [
    { key: "role", label: "Role", type: "text" },
    { key: "powerSource", label: "Power Source", type: "text" },
    { key: "hitPointsAt1", label: "HP At 1", type: "number" },
    { key: "hitPointsPerLevel", label: "HP Per Level", type: "number" },
    { key: "healingSurgesBase", label: "Healing Surges", type: "number" },
    { key: "keyAbilities", label: "Key Abilities", type: "text" }
  ],
  powers: [
    { key: "classId", label: "Class ID", type: "text" },
    { key: "usage", label: "Usage", type: "text" },
    { key: "level", label: "Level", type: "number" },
    { key: "keywords", label: "Keywords", type: "text" },
    { key: "display", label: "Display", type: "text" }
  ],
  feats: [
    { key: "tier", label: "Tier", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "shortDescription", label: "Short Description", type: "text" },
    { key: "prereqsRaw", label: "Prereqs", type: "text" }
  ],
  themes: [{ key: "prereqsRaw", label: "Prereqs", type: "text" }],
  paragonPaths: [{ key: "prereqsRaw", label: "Prereqs", type: "text" }],
  epicDestinies: [{ key: "prereqsRaw", label: "Prereqs", type: "text" }],
  racialTraits: [
    { key: "shortDescription", label: "Short Description", type: "text" },
    { key: "body", label: "Body", type: "text" }
  ],
  hybridClasses: [
    { key: "baseClassId", label: "Base Class ID", type: "text" },
    { key: "hitPointsAt1", label: "HP At 1", type: "number" },
    { key: "hitPointsPerLevel", label: "HP Per Level", type: "number" },
    { key: "healingSurgesBase", label: "Healing Surges", type: "number" },
    { key: "keyAbilities", label: "Key Abilities", type: "text" },
    { key: "role", label: "Role", type: "text" },
    { key: "powerSource", label: "Power Source", type: "text" }
  ],
  armors: [
    { key: "armorType", label: "Armor Type", type: "text" },
    { key: "armorCategory", label: "Armor Category", type: "text" },
    { key: "armorBonus", label: "Armor Bonus", type: "number" },
    { key: "checkPenalty", label: "Check Penalty", type: "number" },
    { key: "speedPenalty", label: "Speed Penalty", type: "number" }
  ],
  weapons: [
    { key: "proficiencyBonus", label: "Prof Bonus", type: "number" },
    { key: "damage", label: "Damage", type: "text" },
    { key: "weaponCategory", label: "Category", type: "text" },
    { key: "handsRequired", label: "Hands Required", type: "text" },
    { key: "weaponGroup", label: "Weapon Group", type: "text" },
    { key: "properties", label: "Properties", type: "text" },
    { key: "range", label: "Range", type: "text" },
    { key: "itemSlot", label: "Item Slot", type: "text" }
  ],
  implements: [
    { key: "implementGroup", label: "Implement Group", type: "text" },
    { key: "properties", label: "Properties", type: "text" },
    { key: "itemSlot", label: "Item Slot", type: "text" }
  ]
};

function withClassReferenceOptions(
  fields: FieldDef[],
  classOptions: Array<{ value: string; label: string }>
): FieldDef[] {
  return fields.map((field) => {
    if (field.key === "classId" || field.key === "baseClassId") {
      return {
        ...field,
        label: field.key === "classId" ? "Class" : "Base Class",
        options: classOptions,
        emptyOptionLabel: "Select class..."
      };
    }
    return field;
  });
}

function makeDefaultDraft(): Record<string, unknown> {
  return { id: "", name: "", slug: "", raw: {} };
}

function slugifyPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function usageToBucket(usage: string): string {
  const normalized = usage.toLowerCase();
  if (normalized.includes("at-will")) return "atwill";
  if (normalized.includes("encounter")) return "enc";
  if (normalized.includes("daily")) return "daily";
  if (normalized.includes("utility")) return "util";
  return slugifyPart(usage).slice(0, 8);
}

function formatDraft(draft: Record<string, unknown>): string {
  return JSON.stringify(draft, null, 2);
}

function collectionItems(index: RulesIndex, collection: EditableResourceCollection): Array<Record<string, unknown>> {
  if (collection === "weapons") return (index.weapons ?? []) as Array<Record<string, unknown>>;
  if (collection === "implements") return (index.implements ?? []) as Array<Record<string, unknown>>;
  if (collection === "hybridClasses") return (index.hybridClasses ?? []) as Array<Record<string, unknown>>;
  return index[collection] as unknown as Array<Record<string, unknown>>;
}

function updateCollectionOverlay(
  overlay: ResourceEditorOverlay,
  collection: EditableResourceCollection,
  updater: (previous: ResourceCollectionOverlay) => ResourceCollectionOverlay
): ResourceEditorOverlay {
  const normalized = normalizeResourceEditorOverlay(overlay);
  const existing = normalized.collections[collection] ?? { upserts: {}, deletes: [] };
  return {
    ...normalized,
    collections: {
      ...normalized.collections,
      [collection]: updater(existing)
    }
  };
}

export function ResourceEditorApp({ index, overlay, onSaveOverlay, onResetOverlay }: Props): JSX.Element {
  const [collection, setCollection] = useState<EditableResourceCollection>("races");
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draftObject, setDraftObject] = useState<Record<string, unknown>>(makeDefaultDraft());
  const [draftText, setDraftText] = useState(formatDraft(makeDefaultDraft()));
  const [message, setMessage] = useState<string>("");

  const normalizedOverlay = useMemo(() => normalizeResourceEditorOverlay(overlay), [overlay]);
  const items = useMemo(() => collectionItems(index, collection), [collection, index]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const id = typeof item.id === "string" ? item.id : "";
      const name = typeof item.name === "string" ? item.name : "";
      return !query || id.toLowerCase().includes(query) || name.toLowerCase().includes(query);
    });
  }, [items, search]);
  const referentialWarnings = useMemo(
    () => getReferentialWarnings(collection, draftObject, index, selectedId),
    [collection, draftObject, index, selectedId]
  );
  const classOptions = useMemo(
    () => index.classes.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.id})` })),
    [index.classes]
  );

  const fieldDefs = useMemo(
    () => [...COMMON_FIELDS, ...withClassReferenceOptions(COLLECTION_FIELDS[collection], classOptions)],
    [classOptions, collection]
  );

  const usedIds = useMemo(() => new Set(items.map((entry) => String(entry.id ?? "").trim()).filter(Boolean)), [items]);

  function applyDraft(nextDraft: Record<string, unknown>): void {
    setDraftObject(nextDraft);
    setDraftText(formatDraft(nextDraft));
  }

  function beginCreate(): void {
    setSelectedId("");
    applyDraft(makeDefaultDraft());
    setMessage("Creating a new entry.");
  }

  function selectExisting(id: string): void {
    setSelectedId(id);
    const row = items.find((item) => item.id === id);
    applyDraft((row ?? makeDefaultDraft()) as Record<string, unknown>);
    setMessage("");
  }

  function updateStructuredField(field: FieldDef, value: string): void {
    const nextDraft = { ...draftObject };
    if (field.type === "number") {
      if (value.trim() === "") {
        delete nextDraft[field.key];
      } else {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          setMessage(`${field.label} must be a number.`);
          return;
        }
        nextDraft[field.key] = numeric;
      }
    } else if (value.trim() === "") {
      delete nextDraft[field.key];
    } else {
      nextDraft[field.key] = value;
    }
    if (!("raw" in nextDraft) || typeof nextDraft.raw !== "object" || nextDraft.raw === null) {
      nextDraft.raw = {};
    }

    if (collection === "powers" && field.key === "name") {
      const currentId = String(nextDraft.id ?? "").trim();
      const currentSlug = String(nextDraft.slug ?? "").trim();
      if (!currentId || !currentSlug) {
        const suggestion = suggestPowerIdentifiers(nextDraft);
        if (!currentId) nextDraft.id = suggestion.id;
        if (!currentSlug) nextDraft.slug = suggestion.slug;
      }
    }

    applyDraft(nextDraft);
    setMessage("");
  }

  function suggestPowerIdentifiers(sourceDraft: Record<string, unknown>): { id: string; slug: string } {
    const name = String(sourceDraft.name ?? "").trim();
    if (!name) {
      return { id: "", slug: "" };
    }
    const classId = slugifyPart(String(sourceDraft.classId ?? "").trim());
    const usage = usageToBucket(String(sourceDraft.usage ?? "").trim());
    const levelValue = sourceDraft.level;
    const numericLevel = typeof levelValue === "number" ? levelValue : Number(levelValue);
    const level = Number.isFinite(numericLevel) ? Math.max(0, Math.trunc(numericLevel)) : undefined;
    const levelPart = level === undefined ? "" : `-l${level}`;
    const namePart = slugifyPart(name);
    const baseParts = [classId, usage, namePart].filter(Boolean);
    const base = baseParts.join("-") + levelPart;
    const baseId = base || namePart || "power";
    const reserved = new Set(usedIds);
    if (selectedId) {
      reserved.delete(selectedId);
    }
    let candidate = baseId;
    let suffix = 2;
    while (reserved.has(candidate)) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return { id: candidate, slug: candidate };
  }

  function applySuggestedPowerIdentifiers(): void {
    if (collection !== "powers") return;
    const suggestion = suggestPowerIdentifiers(draftObject);
    if (!suggestion.id) {
      setMessage("Set a power name first to generate an ID.");
      return;
    }
    const nextDraft = {
      ...draftObject,
      id: suggestion.id,
      slug: suggestion.slug
    };
    if (!("raw" in nextDraft) || typeof nextDraft.raw !== "object" || nextDraft.raw === null) {
      nextDraft.raw = {};
    }
    applyDraft(nextDraft);
    setMessage(`Suggested ID: ${suggestion.id}`);
  }

  function saveDraft(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftText);
    } catch {
      setMessage("Draft must be valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setMessage("Draft must be a JSON object.");
      return;
    }
    const id = (parsed as Record<string, unknown>).id;
    if (typeof id !== "string" || id.trim().length === 0) {
      setMessage("Draft must include a non-empty string `id`.");
      return;
    }
    const duplicateBaseItem = items.some((item) => item.id === id.trim());
    if (!selectedId && duplicateBaseItem) {
      setMessage(`ID ${id.trim()} already exists in ${LABELS[collection].toLowerCase()}.`);
      return;
    }
    const nextId = id.trim();
    const nextOverlay = updateCollectionOverlay(normalizedOverlay, collection, (previous) => {
      const upserts = { ...previous.upserts, [nextId]: parsed };
      if (selectedId && selectedId !== nextId) {
        delete upserts[selectedId];
      }
      const deletes = previous.deletes.filter((entry) => entry !== nextId && entry !== selectedId);
      if (selectedId && selectedId !== nextId) {
        deletes.push(selectedId);
      }
      return { upserts, deletes };
    });
    onSaveOverlay(nextOverlay);
    setSelectedId(nextId);
    setDraftObject(parsed as Record<string, unknown>);
    setMessage(`Saved ${nextId}.`);
  }

  function toggleDeleteSelected(): void {
    if (!selectedId) {
      setMessage("Select an existing entry to mark delete/restore.");
      return;
    }
    const nextOverlay = updateCollectionOverlay(normalizedOverlay, collection, (previous) => {
      const deleteSet = new Set(previous.deletes);
      if (deleteSet.has(selectedId)) {
        deleteSet.delete(selectedId);
      } else {
        deleteSet.add(selectedId);
      }
      return { upserts: { ...previous.upserts }, deletes: [...deleteSet] };
    });
    onSaveOverlay(nextOverlay);
    setMessage(
      normalizedOverlay.collections[collection]?.deletes.includes(selectedId)
        ? `Restored ${selectedId}.`
        : `Marked ${selectedId} as deleted.`
    );
  }

  function resetCurrentType(): void {
    const nextOverlay = updateCollectionOverlay(normalizedOverlay, collection, () => ({ upserts: {}, deletes: [] }));
    onSaveOverlay(nextOverlay);
    setMessage(`Cleared overlay for ${LABELS[collection].toLowerCase()}.`);
  }

  const selectedDeleted = selectedId
    ? normalizedOverlay.collections[collection]?.deletes.includes(selectedId) ?? false
    : false;
  const collectionOverlay = normalizedOverlay.collections[collection] ?? { upserts: {}, deletes: [] };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "clamp(0.75rem, 1.5vw, 1.15rem)", color: "var(--text-primary)", boxSizing: "border-box" }}>
      <h1 style={{ marginTop: 0 }}>Resource Editor</h1>
      <p style={{ marginTop: 0, color: "var(--text-muted)" }}>
        Local prototype mode: edits are stored in browser storage and layered over generated rules data.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <label>
          Resource Type{" "}
          <select
            value={collection}
            onChange={(event) => {
              setCollection(event.target.value as EditableResourceCollection);
              setSelectedId("");
              applyDraft(makeDefaultDraft());
              setMessage("");
            }}
          >
            {EDITABLE_RESOURCE_COLLECTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search{" "}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by id or name"
            style={{ minWidth: 280 }}
          />
        </label>
        <button type="button" onClick={beginCreate}>
          Add New
        </button>
        <button type="button" onClick={toggleDeleteSelected} disabled={!selectedId}>
          {selectedDeleted ? "Restore" : "Delete"} Selected
        </button>
        <button type="button" onClick={saveDraft}>
          Save Draft
        </button>
        {collection === "powers" && (
          <button type="button" onClick={applySuggestedPowerIdentifiers}>
            Suggest ID
          </button>
        )}
        <button type="button" onClick={resetCurrentType}>
          Reset Type Overlay
        </button>
        <button
          type="button"
          onClick={() => {
            onResetOverlay();
            setSelectedId("");
              applyDraft(makeDefaultDraft());
            setMessage("Cleared entire editor overlay.");
          }}
        >
          Reset All Overlay
        </button>
      </div>

      <div
        role="status"
        aria-live="polite"
        style={{ marginBottom: "0.75rem", color: message.includes("must") ? "var(--status-danger)" : "var(--text-secondary)" }}
      >
        {message || "Select an item or create a new draft."}
      </div>
      {referentialWarnings.length > 0 && (
        <div
          style={{
            marginBottom: "0.75rem",
            border: "1px solid var(--status-warning)",
            backgroundColor: "var(--surface-0)",
            borderRadius: 8,
            padding: "0.6rem 0.75rem"
          }}
        >
          <strong style={{ fontSize: "0.85rem", color: "var(--status-warning)" }}>Editor warnings</strong>
          <ul style={{ margin: "0.35rem 0 0 1rem", color: "var(--status-warning)", fontSize: "0.85rem" }}>
            {referentialWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", minHeight: "60vh" }}>
        <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, backgroundColor: "var(--surface-0)", overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--panel-border)", fontWeight: 600 }}>
            {LABELS[collection]} ({filteredItems.length})
          </div>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            {filteredItems.map((item) => {
              const id = String(item.id ?? "");
              const name = String(item.name ?? id);
              const isDeleted = collectionOverlay.deletes.includes(id);
              const isOverlayUpsert = id in collectionOverlay.upserts;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectExisting(id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid var(--surface-2)",
                    padding: "0.55rem 0.75rem",
                    background: selectedId === id ? "var(--surface-2)" : "var(--surface-0)",
                    cursor: "pointer",
                    opacity: isDeleted ? 0.55 : 1
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{id}</div>
                  {isOverlayUpsert && <div style={{ fontSize: "0.75rem", color: "var(--status-info)" }}>overlay override</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ border: "1px solid var(--panel-border)", borderRadius: 8, backgroundColor: "var(--surface-0)", padding: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <strong>Structured Editor + JSON Draft</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
              {selectedId ? `Editing: ${selectedId}` : "New entry mode"}
            </span>
          </div>
          <StructuredFieldGrid fields={fieldDefs} draft={draftObject} onFieldChange={updateStructuredField} />
          <textarea
            value={draftText}
            onChange={(event) => {
              const nextText = event.target.value;
              setDraftText(nextText);
              try {
                const parsed = JSON.parse(nextText) as unknown;
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  setDraftObject(parsed as Record<string, unknown>);
                  setMessage("");
                }
              } catch {
                // Keep freeform JSON editing possible even while temporarily invalid.
              }
            }}
            style={{
              width: "100%",
              minHeight: "42vh",
              boxSizing: "border-box",
              fontFamily: "Consolas, monospace",
              fontSize: "0.85rem",
              borderRadius: 6,
              border: "1px solid var(--panel-border)",
              padding: "0.75rem"
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function createEmptyOverlayForTests(): ResourceEditorOverlay {
  return emptyResourceEditorOverlay();
}
