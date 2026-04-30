/**
 * Server-safe parsing/validation for POST /api/reports.
 * No React or DOM dependencies — safe to import from Vite Node middleware.
 */

import type { BugSeverity, ReportCategory, ReportPayload } from "./model";
import { REPORT_OPTIONAL_TEXT_MAX, validateReportForm, type ReportFormInput } from "./model";

const SEVERITIES: BugSeverity[] = ["low", "medium", "high", "critical"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function asOptionalString(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length > max) return null;
  return t;
}

function asCategory(v: unknown): ReportCategory | null {
  if (v === "feedback" || v === "bug") return v;
  return null;
}

function asSeverity(v: unknown): BugSeverity | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  return SEVERITIES.includes(v as BugSeverity) ? (v as BugSeverity) : undefined;
}

function asMetadataString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export type ParseReportBodyError = {
  status: 400;
  body: { ok: false; error: string; fields?: Record<string, string> };
};

export type ParseReportBodySuccess = { status: 200; payload: ReportPayload };

/**
 * Parse JSON body from the client into a normalized ReportPayload, or a 400 error shape.
 */
export function parseReportBodyJson(json: unknown): ParseReportBodyError | ParseReportBodySuccess {
  if (!isRecord(json)) {
    return {
      status: 400,
      body: { ok: false, error: "invalid_json", fields: { _root: "Body must be a JSON object." } }
    };
  }

  const category = asCategory(json.category);
  if (!category) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "validation_failed",
        fields: { category: "Must be feedback or bug." }
      }
    };
  }

  const input: ReportFormInput = {
    category,
    title: typeof json.title === "string" ? json.title : "",
    description: typeof json.description === "string" ? json.description : ""
  };

  if (category === "bug") {
    const sr = asOptionalString(json.stepsToReproduce, REPORT_OPTIONAL_TEXT_MAX);
    const exp = asOptionalString(json.expectedBehavior, REPORT_OPTIONAL_TEXT_MAX);
    const act = asOptionalString(json.actualBehavior, REPORT_OPTIONAL_TEXT_MAX);
    if (sr === null || exp === null || act === null) {
      return {
        status: 400,
        body: {
          ok: false,
          error: "validation_failed",
          fields: {
            ...(sr === null ? { stepsToReproduce: "Invalid or too long." } : {}),
            ...(exp === null ? { expectedBehavior: "Invalid or too long." } : {}),
            ...(act === null ? { actualBehavior: "Invalid or too long." } : {})
          }
        }
      };
    }
    input.stepsToReproduce = sr;
    input.expectedBehavior = exp;
    input.actualBehavior = act;
    input.severity = asSeverity(json.severity);
  }

  const clientErrors = validateReportForm(input);
  if (Object.keys(clientErrors).length > 0) {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(clientErrors)) {
      if (v) fields[k] = v;
    }
    return { status: 400, body: { ok: false, error: "validation_failed", fields } };
  }

  const title = input.title.trim();
  const description = input.description.trim();

  const hashRoute = asMetadataString(json.hashRoute, 500);
  const userAgent = asMetadataString(json.userAgent, 2000);
  const appVersion = asMetadataString(json.appVersion, 100);
  const createdAtRaw = typeof json.createdAt === "string" ? json.createdAt.trim() : "";

  if (!hashRoute || !userAgent || !appVersion) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "validation_failed",
        fields: {
          ...(!hashRoute ? { hashRoute: "Required metadata missing or invalid." } : {}),
          ...(!userAgent ? { userAgent: "Required metadata missing or invalid." } : {}),
          ...(!appVersion ? { appVersion: "Required metadata missing or invalid." } : {})
        }
      }
    };
  }

  let createdAt = createdAtRaw;
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    createdAt = new Date().toISOString();
  }

  const payload: ReportPayload = {
    category,
    title,
    description,
    hashRoute,
    userAgent,
    appVersion,
    createdAt,
    ...(category === "bug"
      ? {
          stepsToReproduce: input.stepsToReproduce ?? "",
          expectedBehavior: input.expectedBehavior ?? "",
          actualBehavior: input.actualBehavior ?? "",
          severity: input.severity
        }
      : {})
  };

  return { status: 200, payload };
}
