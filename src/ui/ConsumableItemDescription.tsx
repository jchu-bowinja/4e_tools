import type { CSSProperties } from "react";
import { RulesRichText } from "./RulesRichText";
import type { ConsumableDescriptionParts } from "../rules/consumablesDisplay";

const flavorParagraphStyle: CSSProperties = { fontSize: "0.85rem", fontStyle: "italic" };
const bodyParagraphStyle: CSSProperties = { fontSize: "0.85rem" };
const listItemStyle: CSSProperties = { fontSize: "0.85rem" };

export function ConsumableItemDescription({ flavor, body }: ConsumableDescriptionParts): JSX.Element | null {
  if (!flavor?.trim() && !body?.trim()) return null;

  return (
    <>
      {flavor?.trim() ? (
        <RulesRichText
          text={flavor}
          paragraphStyle={flavorParagraphStyle}
          listItemStyle={listItemStyle}
        />
      ) : null}
      {body?.trim() ? (
        <RulesRichText text={body} paragraphStyle={bodyParagraphStyle} listItemStyle={listItemStyle} />
      ) : null}
    </>
  );
}
