import { describe, expect, it } from "vitest";
import { parseReportBodyJson } from "../../../src/features/reporting/validatePayload";

const base = {
  category: "enhancement",
  title: "Title",
  description: "Description text",
  hashRoute: "#/monsters",
  userAgent: "Vitest",
  appVersion: "0.1.0",
  createdAt: "2026-01-01T00:00:00.000Z"
};

describe("parseReportBodyJson", () => {
  it("parses enhancement payload", () => {
    const r = parseReportBodyJson(base);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.payload.category).toBe("enhancement");
    expect(r.payload.title).toBe("Title");
  });

  it("requires bug fields shapes", () => {
    const r = parseReportBodyJson({
      ...base,
      category: "bug",
      stepsToReproduce: "x".repeat(5000)
    });
    expect(r.status).toBe(400);
  });

  it("parses bug with optional reproduction text", () => {
    const r = parseReportBodyJson({
      ...base,
      category: "bug",
      stepsToReproduce: "Hit go",
      expectedBehavior: "",
      actualBehavior: "",
      severity: "medium"
    });
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.payload.stepsToReproduce).toBe("Hit go");
  });

  it("errors on invalid category", () => {
    expect(parseReportBodyJson({ ...base, category: "other" }).status).toBe(400);
  });

  it("rejects legacy feedback category", () => {
    expect(parseReportBodyJson({ ...base, category: "feedback" }).status).toBe(400);
  });

  it("rejects suggestion category (no longer supported)", () => {
    expect(parseReportBodyJson({ ...base, category: "suggestion" }).status).toBe(400);
  });

  it("parses documentation and question", () => {
    expect(parseReportBodyJson({ ...base, category: "documentation" }).status).toBe(200);
    expect(parseReportBodyJson({ ...base, category: "question" }).status).toBe(200);
  });

  it("fills createdAt when missing", () => {
    const body = { ...base };
    delete (body as { createdAt?: string }).createdAt;
    const r = parseReportBodyJson(body);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.payload.createdAt).toMatch(/^\d{4}-/);
  });
});
