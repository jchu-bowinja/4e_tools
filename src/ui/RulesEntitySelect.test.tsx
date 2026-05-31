import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RulesEntitySelectOptionLabel } from "./RulesEntitySelect";

describe("RulesEntitySelectOptionLabel", () => {
  it("renders name and source in one row", () => {
    const html = renderToStaticMarkup(<RulesEntitySelectOptionLabel name="Cleric" source="Player's Handbook" />);
    expect(html).toContain("Cleric");
    expect(html).toContain("Player");
    expect(html).toContain("Handbook");
  });

  it("renders name only when source is empty", () => {
    const html = renderToStaticMarkup(<RulesEntitySelectOptionLabel name="Human" source="" />);
    expect(html).toContain("Human");
    expect(html).not.toContain("Handbook");
  });
});
