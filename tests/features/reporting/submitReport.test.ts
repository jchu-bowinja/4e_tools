import { describe, expect, it, vi } from "vitest";
import { emptyReportForm } from "../../../src/features/reporting/model";
import { submitReport } from "../../../src/features/reporting/submitReport";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

describe("submitReport", () => {
  it("returns client_validation when fields invalid", async () => {
    const fetchImpl = vi.fn();
    const r = await submitReport(
      { ...emptyReportForm(), title: "", description: "" },
      { hashRoute: "#/b", userAgent: "ua", appVersion: "0.1.0" },
      { fetchImpl }
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, kind: "client_validation", fieldErrors: expect.any(Object) });
  });

  it("returns success id on OK response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, id: "abc-123" }));
    const r = await submitReport(
      { ...emptyReportForm(), title: "T", description: "D" },
      { hashRoute: "#/b", userAgent: "ua", appVersion: "0.1.0" },
      { fetchImpl }
    );
    expect(r).toEqual({ ok: true, id: "abc-123" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init!.method).toBe("POST");
    expect(JSON.parse(String(init!.body))).toMatchObject({ title: "T", hashRoute: "#/b" });
  });

  it("maps server validation fields", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          ok: false,
          error: "validation_failed",
          fields: { title: "Too short." }
        },
        400
      )
    );
    const r = await submitReport(
      { ...emptyReportForm(), title: "OK", description: "D" },
      { hashRoute: "#/b", userAgent: "ua", appVersion: "0.1.0" },
      { fetchImpl }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("server");
    if (r.ok === false && r.kind === "server") {
      expect(r.fieldErrors?.title).toBe("Too short.");
      expect(r.status).toBe(400);
    }
  });

  it("handles network errors", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const r = await submitReport(
      { ...emptyReportForm(), title: "T", description: "D" },
      { hashRoute: "#/b", userAgent: "ua", appVersion: "0.1.0" },
      { fetchImpl }
    );
    expect(r).toEqual({ ok: false, kind: "network", message: "offline" });
  });
});
