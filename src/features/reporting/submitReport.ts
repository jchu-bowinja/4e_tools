import type { ReportPayload } from "./model";
import { buildReportPayload, validateReportForm, type ReportFormInput } from "./model";

export type SubmitReportSuccess = { ok: true; id: string };

export type SubmitReportFailure =
  | { ok: false; kind: "client_validation"; fieldErrors: Record<string, string> }
  | { ok: false; kind: "network"; message: string }
  | {
      ok: false;
      kind: "server";
      status: number;
      message: string;
      errorCode?: string;
      fieldErrors?: Record<string, string>;
    }
  | { ok: false; kind: "parse"; message: string };

export type SubmitReportResult = SubmitReportSuccess | SubmitReportFailure;

type WireOk = { ok: true; id: string };
type WireErr = { ok: false; error: string; fields?: Record<string, string> };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseWireJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface SubmitReportOptions {
  /** Override for tests */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Validates form input client-side, builds payload with metadata, POSTs to /api/reports.
 */
export async function submitReport(
  input: ReportFormInput,
  meta: { hashRoute: string; userAgent: string; appVersion: string },
  options: SubmitReportOptions = {}
): Promise<SubmitReportResult> {
  const fieldErrors = validateReportForm(input);
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) {
    if (v) clean[k] = v;
  }
  if (Object.keys(clean).length > 0) {
    return { ok: false, kind: "client_validation", fieldErrors: clean };
  }

  const payload: ReportPayload = buildReportPayload(input, meta);
  const doFetch = options.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: options.signal
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, kind: "network", message: msg };
  }

  const rawText = await res.text().catch(() => "");
  const json = rawText ? parseWireJson(rawText) : null;

  if (!isRecord(json)) {
    return {
      ok: false,
      kind: "parse",
      message: res.ok ? "Empty or invalid JSON from server." : `HTTP ${String(res.status)}`
    };
  }

  if (
    res.ok &&
    json.ok === true &&
    typeof json.id === "string" &&
    json.id.length > 0
  ) {
    return { ok: true, id: json.id };
  }

  if (json.ok === false && typeof json.error === "string") {
    const err = json as WireErr;
    const fields = err.fields && isRecord(err.fields) ? err.fields : undefined;
    const fieldErrors: Record<string, string> = {};
    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        if (typeof v === "string" && v) fieldErrors[k] = v;
      }
    }
    const message =
      typeof fields?._root === "string"
        ? String(fields._root)
        : err.error === "validation_failed"
          ? "Please fix the highlighted fields."
          : err.error;

    return {
      ok: false,
      kind: "server",
      status: res.status,
      message,
      errorCode: err.error,
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      kind: "server",
      status: res.status,
      message: rawText.trim() ? rawText.trim() : `Request failed (${String(res.status)}).`,
      errorCode: "unknown"
    };
  }

  return { ok: false, kind: "parse", message: "Unexpected server response shape." };
}
