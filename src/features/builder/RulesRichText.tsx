import type { CSSProperties, ReactNode } from "react";

type Block = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

/** ✦ (U+2726) and ★ (U+2605) — common in Compendium / PHB text as inline bullet markers. */
const STAR_SPLIT = /\s*[\u2726\u2605]\s*/;

const LINE_BULLET = /^\s*(?:[*•\-]|(?:\d+[.)]))\s+(.*)$/;

/**
 * Turns Compendium-style prose into paragraphs + lists:
 * - Splits on ✦ / ★ into an intro paragraph and bullet list
 * - If no stars, detects a block of lines starting with *, -, •, or 1. / 1)
 */
export function parseRulesDescriptionText(text: string): Block[] {
  const t = text.trim();
  if (!t) return [];

  if (/[\u2726\u2605]/.test(t)) {
    const parts = t.split(STAR_SPLIT).map((s) => s.trim());
    const nonEmpty = parts.filter(Boolean);
    if (nonEmpty.length <= 1) return [{ kind: "paragraph", text: t }];
    const [first, ...rest] = nonEmpty;
    const blocks: Block[] = [];
    if (first) blocks.push({ kind: "paragraph", text: first });
    blocks.push({ kind: "list", items: rest });
    return blocks;
  }

  const lines = t.split(/\r?\n/);
  let firstBullet = -1;
  for (let i = 0; i < lines.length; i++) {
    if (LINE_BULLET.test(lines[i])) {
      firstBullet = i;
      break;
    }
  }
  if (firstBullet > 0) {
    const intro = lines.slice(0, firstBullet).join("\n").trim();
    const items: string[] = [];
    for (let i = firstBullet; i < lines.length; i++) {
      const m = lines[i].match(LINE_BULLET);
      if (m?.[1]) items.push(m[1].trim());
    }
    if (items.length >= 1) {
      const blocks: Block[] = [];
      if (intro) blocks.push({ kind: "paragraph", text: intro });
      blocks.push({ kind: "list", items });
      return blocks;
    }
  }

  return [{ kind: "paragraph", text: t }];
}

/** Glossary hover panels and editor preview: ✦ / ★ become real bullet lists (see `parseRulesDescriptionText`). */
export function GlossaryTooltipRichText(props: { text: string }): ReactNode {
  const { text } = props;
  return (
    <RulesRichText
      text={text}
      paragraphStyle={{ lineHeight: 1.35 }}
      listStyle={{ lineHeight: 1.35 }}
      listItemStyle={{ lineHeight: 1.35 }}
    />
  );
}

export function RulesRichText(props: {
  text: string;
  paragraphStyle?: CSSProperties;
  listStyle?: CSSProperties;
  listItemStyle?: CSSProperties;
}): ReactNode {
  const { text, paragraphStyle, listStyle, listItemStyle } = props;
  const blocks = parseRulesDescriptionText(text);
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        if (b.kind === "paragraph") {
          return (
            <p
              key={`p-${i}`}
              style={{
                whiteSpace: "pre-wrap",
                margin: isLast ? 0 : "0 0 0.6rem 0",
                lineHeight: 1.45,
                ...paragraphStyle
              }}
            >
              {b.text}
            </p>
          );
        }
        return (
          <ul
            key={`ul-${i}`}
            style={{
              margin: isLast ? "0.25rem 0 0 0" : "0.25rem 0 0.5rem 0",
              paddingLeft: "1.35rem",
              listStyleType: "disc",
              lineHeight: 1.45,
              ...listStyle
            }}
          >
            {b.items.map((item, j) => (
              <li key={j} style={{ marginBottom: j < b.items.length - 1 ? "0.35rem" : 0, ...listItemStyle }}>
                {item}
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}
