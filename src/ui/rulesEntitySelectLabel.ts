const PAD = "\u00a0";

/** Widest `name` length among entities shown in a rules-entity `<select>`. */
export function rulesEntityNameColumnWidth(entities: readonly { name: string }[]): number {
  let max = 0;
  for (const entity of entities) {
    const len = entity.name.length;
    if (len > max) max = len;
  }
  return max;
}

/**
 * Option text for race/class selects: name on the left, source right-aligned in a fixed column.
 * Use with a monospace font on the `<select>` so padding aligns in the closed control and list.
 */
export function formatRulesEntitySelectOptionLabel(
  name: string,
  source: string | undefined | null,
  nameColumnWidth: number
): string {
  const src = String(source ?? "").trim();
  if (!src) return name;
  const col = Math.max(nameColumnWidth, name.length);
  return `${name.padEnd(col, PAD)}${PAD}${src}`;
}
