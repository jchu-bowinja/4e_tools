import { describe, expect, it } from "vitest";
import {
  buildMonsterTemplatesExportFile,
  normalizeImportedTemplateRecord,
  parseMonsterTemplatesImportJson,
  stringifyMonsterTemplatesJsonFile
} from "./monsterTemplatesJsonFile";
import type { MonsterTemplateRecord } from "./storage";

const minimalTemplate = (name: string): MonsterTemplateRecord => ({
  templateName: name,
  sourceBook: "manual import",
  powers: [{ name: "X", usage: "At-Will", action: "Standard", keywords: "", description: "" }]
});

describe("buildMonsterTemplatesExportFile", () => {
  it("matches monster_templates.json top-level shape with meta + templates", () => {
    const templates: MonsterTemplateRecord[] = [minimalTemplate("Test")];
    const file = buildMonsterTemplatesExportFile(templates);
    expect(Array.isArray(file.templates)).toBe(true);
    expect(file.templates).toHaveLength(1);
    expect(file.meta.templateCount).toBe(1);
    expect(file.meta.source).toBe("4e-builder.monsterEditor.exportTemplates");
    expect(file.meta.dedupeKey).toBe("normalizedTemplateName");
    expect(typeof file.meta.exportedAt).toBe("string");
    const text = stringifyMonsterTemplatesJsonFile(file);
    expect(text.trimStart().startsWith("{")).toBe(true);
    const roundTrip = JSON.parse(text) as { meta: unknown; templates: unknown };
    expect(roundTrip.meta).toEqual(file.meta);
    expect(roundTrip.templates).toEqual(file.templates);
  });
});

describe("parseMonsterTemplatesImportJson", () => {
  it("parses exported bundle", () => {
    const text = stringifyMonsterTemplatesJsonFile(buildMonsterTemplatesExportFile([minimalTemplate("A")]));
    const r = parseMonsterTemplatesImportJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templates.map((t) => t.templateName)).toEqual(["A"]);
  });

  it("parses a single template object", () => {
    const r = parseMonsterTemplatesImportJson(JSON.stringify(minimalTemplate("Solo")));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templates).toHaveLength(1);
  });

  it("parses an array of templates", () => {
    const r = parseMonsterTemplatesImportJson(
      JSON.stringify([minimalTemplate("One"), minimalTemplate("Two")])
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.templates.map((t) => t.templateName)).toEqual(["One", "Two"]);
  });

  it("rejects empty templates array in bundle", () => {
    const r = parseMonsterTemplatesImportJson(JSON.stringify({ meta: {}, templates: [] }));
    expect(r.ok).toBe(false);
  });

  it("normalizes missing sourceBook and powers array", () => {
    const raw = { templateName: "Z", powers: undefined as unknown } as MonsterTemplateRecord;
    const n = normalizeImportedTemplateRecord(raw);
    expect(n.sourceBook).toBe("manual import");
    expect(Array.isArray(n.powers)).toBe(true);
    expect(n.powers).toHaveLength(0);
  });
});
