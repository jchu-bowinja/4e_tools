export type AdjustableNumberBlurResult =
  | { kind: "commit"; value: number | undefined }
  | { kind: "revert" };

/** Validate numeric field text on blur; invalid input should revert to the prior value. */
export function parseAdjustableNumberBlur(
  raw: string,
  options: { min: number; max: number; optional: boolean }
): AdjustableNumberBlurResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    if (options.optional) return { kind: "commit", value: undefined };
    return { kind: "revert" };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { kind: "revert" };
  const next = parsed;
  if (next < options.min || next > options.max) return { kind: "revert" };
  return { kind: "commit", value: next };
}
