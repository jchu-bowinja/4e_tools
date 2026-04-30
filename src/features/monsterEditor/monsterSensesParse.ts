/**
 * Shared parsing for monster stat block vision/senses lines (MM & MM3).
 *
 * Initiative lines look like: `Senses Perception +13; truesight 6` — Perception is a skill,
 * not a sense entry. Remaining segments become `{ name, range }` (range 0 when no number).
 */

export function stripPerceptionPrefixFromSensesTail(tail: string): string {
  let t = tail.trim();
  t = t.replace(/^\s*Perception\s+[+-]?\d+\s*/i, "").trim();
  t = t.replace(/^[;,]\s*/, "").trim();
  return t;
}

/**
 * Parse sense segments from text after an optional Perception prefix has been removed (or from a speed-line tail).
 * Splits on `,` and `;`. A trailing integer is the range in squares; otherwise range is 0.
 */
export function parseMonsterSensesSegments(s: string): Array<{ name: string; range: number }> {
  const afterPerc = stripPerceptionPrefixFromSensesTail(s);
  if (!afterPerc) return [];
  const out: Array<{ name: string; range: number }> = [];
  for (const segment of afterPerc.split(/[;,]/)) {
    const seg = segment.trim();
    if (!seg) continue;
    if (/^perception\s+[+-]?\d+$/i.test(seg)) continue;
    const m = seg.match(/^(.+?)\s+(\d+)\s*$/);
    if (m) {
      const namePart = m[1].trim();
      if (/^perception$/i.test(namePart)) continue;
      out.push({ name: namePart, range: Number.parseInt(m[2], 10) });
    } else {
      out.push({ name: seg, range: 0 });
    }
  }
  return out;
}

/** Vision phrases that may appear after movement on the Speed line (match case-insensitively). */
const SPEED_LINE_SENSE_PHRASES_LC = [
  "darkvision",
  "low-light vision",
  "tremorsense",
  "blindsight",
  "truesight"
];

/**
 * Where a sense phrase starts on the remainder of a line after `Speed …` (preserves original casing in the slice).
 */
export function findSpeedLineSensePhraseStart(rest: string): number {
  const lower = rest.toLowerCase();
  let cut = rest.length;
  for (const phrase of SPEED_LINE_SENSE_PHRASES_LC) {
    const idx = lower.indexOf(phrase);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  return cut;
}
