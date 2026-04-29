import { describe, expect, it } from "vitest";
import {
  createTemplateDraftFromJson,
  createTemplateDraftFromRecord,
  createTemplateDraftToRecord,
  validateCreateTemplateDraft
} from "./createTemplateDraft";

describe("createTemplateDraft", () => {
  it("maps record to draft and back for phase-1 editable fields", () => {
    const draft = createTemplateDraftFromRecord({
      templateName: "Graveborn",
      sourceBook: "Open Grave",
      roleLine: "Graveborn Elite Controller",
      prerequisite: "Level 10+",
      description: "A cursed shell.",
      statLines: ["Defenses +2 AC", "Hit Points +8 per level + Constitution score"],
      auras: [{ name: "Death Aura", details: "Enemies take necrotic damage.", range: 3 }],
      traits: [{ name: "Undead Fortitude", details: "Gain +2 saves." }],
      powers: [{ name: "Claw", usage: "at-will", action: "standard", keywords: "", description: "Melee attack." }]
    });
    const record = createTemplateDraftToRecord(draft);
    expect(record.templateName).toBe("Graveborn");
    expect(record.sourceBook).toBe("Open Grave");
    expect(record.statLines).toHaveLength(2);
    expect(record.auras?.[0]?.name).toBe("Death Aura");
    expect(record.powers).toHaveLength(1);
  });

  it("returns json parsing error when invalid", () => {
    const parsed = createTemplateDraftFromJson("{");
    expect(parsed.draft).toBeNull();
    expect(parsed.error).toContain("Invalid JSON");
  });

  it("validates required template name", () => {
    const draft = createTemplateDraftFromRecord({ templateName: "", sourceBook: "manual import", powers: [] });
    const errors = validateCreateTemplateDraft(draft);
    expect(errors).toContain("Template name is required.");
  });
});
