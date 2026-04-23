import type { JSX } from "react";

export type FieldType = "text" | "number";
export interface FieldOption {
  value: string;
  label: string;
}

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  emptyOptionLabel?: string;
};

interface Props {
  fields: FieldDef[];
  draft: Record<string, unknown>;
  onFieldChange: (field: FieldDef, value: string) => void;
}

export function StructuredFieldGrid({ fields, draft, onFieldChange }: Props): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
        gap: "0.5rem 0.75rem",
        marginBottom: "0.75rem"
      }}
    >
      {fields.map((field) => {
        const value = draft[field.key];
        const normalizedValue = value === undefined || value === null ? "" : String(value);
        return (
          <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{field.label}</span>
            {field.options ? (
              <select value={normalizedValue} onChange={(event) => onFieldChange(field, event.target.value)}>
                <option value="">{field.emptyOptionLabel ?? "Select..."}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={normalizedValue}
                onChange={(event) => onFieldChange(field, event.target.value)}
                placeholder={field.key}
                type={field.type === "number" ? "number" : "text"}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
