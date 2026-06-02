import type { CSSProperties } from "react";
import { SegmentedControl } from "../../ui/SegmentedControl";
import { ITEMS_CATEGORIES, ITEMS_CATEGORY_LABELS, type ItemsCategory } from "./characterItemsCategories";

export interface CharacterItemsCategoryNavProps {
  value: ItemsCategory;
  onChange: (value: ItemsCategory) => void;
  style?: CSSProperties;
}

export function CharacterItemsCategoryNav({
  value,
  onChange,
  style
}: CharacterItemsCategoryNavProps): JSX.Element {
  return (
    <SegmentedControl
      role="tablist"
      ariaLabel="Item categories"
      variant="pill"
      size="compact"
      value={value}
      onChange={onChange}
      options={ITEMS_CATEGORIES.map((category) => ({
        value: category,
        label: ITEMS_CATEGORY_LABELS[category]
      }))}
      style={{ marginBottom: "0.5rem", flexWrap: "wrap", ...style }}
    />
  );
}
