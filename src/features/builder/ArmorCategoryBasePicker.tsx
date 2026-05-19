import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Armor } from "../../rules/models";
import {
  armorCategoryKey,
  armorsInCategory,
  categoryOrderForArmors,
  formatArmorMaterialLabel,
  sortedArmorCategories
} from "../../rules/armorCategories";

const fieldLabelStyle: CSSProperties = {
  fontSize: "0.88rem",
  display: "grid",
  gap: "0.2rem"
};

const selectInlineStyle: CSSProperties = {
  width: "100%",
  marginTop: 0,
  padding: "0.35rem",
  borderRadius: "6px",
  border: "1px solid var(--panel-border)",
  boxSizing: "border-box"
};

export interface ArmorCategoryBasePickerProps {
  armors: Armor[];
  value: string | undefined;
  onChange: (armorId: string | undefined) => void;
  typeLabel: string;
  materialLabel: string;
  formatMaterialOption?: (armor: Armor) => string;
}

export function ArmorCategoryBasePicker({
  armors,
  value,
  onChange,
  typeLabel,
  materialLabel,
  formatMaterialOption = formatArmorMaterialLabel
}: ArmorCategoryBasePickerProps): JSX.Element {
  const selected = value ? armors.find((a) => a.id === value) : undefined;
  const categories = useMemo(
    () => sortedArmorCategories(armors, categoryOrderForArmors(armors)),
    [armors]
  );

  const [category, setCategory] = useState(() =>
    selected ? armorCategoryKey(selected) : ""
  );

  useEffect(() => {
    if (selected) {
      const next = armorCategoryKey(selected);
      setCategory((prev) => (prev === next ? prev : next));
    }
  }, [selected?.id, selected?.armorCategory]);

  const materials = useMemo(() => armorsInCategory(armors, category), [armors, category]);

  const handleCategoryChange = (nextCategory: string): void => {
    setCategory(nextCategory);
    if (!nextCategory) {
      onChange(undefined);
      return;
    }
    if (selected && armorCategoryKey(selected) !== nextCategory) {
      onChange(undefined);
    }
  };

  return (
    <>
      <label style={fieldLabelStyle}>
        {typeLabel}
        <select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          style={selectInlineStyle}
          aria-label={typeLabel}
        >
          <option value="">Select type…</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldLabelStyle}>
        {materialLabel}
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          style={selectInlineStyle}
          disabled={!category}
          aria-label={materialLabel}
        >
          <option value="">{category ? "None" : "Select type first"}</option>
          {materials.map((armor) => (
            <option key={armor.id} value={armor.id}>
              {formatMaterialOption(armor)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
