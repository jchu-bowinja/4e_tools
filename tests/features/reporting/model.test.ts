import { describe, expect, it } from "vitest";
import {
  buildReportPayload,
  emptyReportForm,
  validateReportForm,
  type ReportFormInput
} from "../../../src/features/reporting/model";

describe("reporting model", () => {
  it("requires title and description", () => {
    expect(
      Object.keys(
        validateReportForm({ ...emptyReportForm(), title: "", description: "" })
      ).length
    ).toBeGreaterThan(0);
  });

  it("accepts valid minimal feedback form", () => {
    expect(
      Object.keys(
        validateReportForm({ ...emptyReportForm("feedback"), title: "Hi", description: "Body" })
      ).length
    ).toBe(0);
  });

  it("enforces bug optional field lengths", () => {
    const long = "x".repeat(4001);
    const input: ReportFormInput = {
      ...emptyReportForm("bug"),
      title: "T",
      description: "D",
      stepsToReproduce: long
    };
    expect(validateReportForm(input).stepsToReproduce).toBeTruthy();
  });

  it("buildReportPayload attaches metadata", () => {
    const payload = buildReportPayload(
      { ...emptyReportForm(), title: " t ", description: " d " },
      {
        hashRoute: "#/builder",
        userAgent: "test-ua",
        appVersion: "0.1.0",
        createdAt: "2026-01-02T03:04:05.000Z"
      }
    );
    expect(payload.title).toBe("t");
    expect(payload.description).toBe("d");
    expect(payload.hashRoute).toBe("#/builder");
    expect(payload.appVersion).toBe("0.1.0");
    expect(payload.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("includes bug-specific fields only for bugs", () => {
    const bug = buildReportPayload(
      {
        ...emptyReportForm("bug"),
        title: "b",
        description: "desc",
        stepsToReproduce: "s",
        severity: "low"
      },
      { hashRoute: "#/", userAgent: "u", appVersion: "v" }
    );
    expect(bug.stepsToReproduce).toBe("s");
    expect(bug.severity).toBe("low");

    const fb = buildReportPayload(
      { ...emptyReportForm("feedback"), title: "f", description: "d" },
      { hashRoute: "#/", userAgent: "u", appVersion: "v" }
    );
    expect(fb).not.toHaveProperty("stepsToReproduce");
  });
});
