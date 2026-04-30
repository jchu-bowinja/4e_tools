/**
 * Shared contract for user reports (feedback, bugs).
 * Used by the report modal and POST /api/reports.
 */

export type ReportCategory = "feedback" | "bug";

export type BugSeverity = "low" | "medium" | "high" | "critical";

/** Form state before client metadata is attached */
export interface ReportFormInput {
  category: ReportCategory;
  title: string;
  description: string;
  /** Bug-only (optional) */
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  severity?: BugSeverity;
}

/** Full payload sent to the server */
export interface ReportPayload extends ReportFormInput {
  hashRoute: string;
  userAgent: string;
  appVersion: string;
  createdAt: string;
}

export const REPORT_TITLE_MAX = 200;
export const REPORT_DESCRIPTION_MAX = 8000;
export const REPORT_OPTIONAL_TEXT_MAX = 4000;

export type ReportFieldErrors = Partial<Record<keyof ReportFormInput, string>>;

export function emptyReportForm(category: ReportCategory = "feedback"): ReportFormInput {
  return {
    category,
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
    severity: undefined
  };
}

function trimToMax(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

/**
 * Client-side validation for form fields; returns field-scoped errors.
 */
export function validateReportForm(input: ReportFormInput): ReportFieldErrors {
  const errors: ReportFieldErrors = {};
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > REPORT_TITLE_MAX) {
    errors.title = `Title must be at most ${REPORT_TITLE_MAX} characters.`;
  }

  if (!description) {
    errors.description = "Description is required.";
  } else if (description.length > REPORT_DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${REPORT_DESCRIPTION_MAX} characters.`;
  }

  if (input.category === "bug") {
    const sr = (input.stepsToReproduce ?? "").trim();
    const exp = (input.expectedBehavior ?? "").trim();
    const act = (input.actualBehavior ?? "").trim();
    if (sr.length > REPORT_OPTIONAL_TEXT_MAX) {
      errors.stepsToReproduce = `Must be at most ${REPORT_OPTIONAL_TEXT_MAX} characters.`;
    }
    if (exp.length > REPORT_OPTIONAL_TEXT_MAX) {
      errors.expectedBehavior = `Must be at most ${REPORT_OPTIONAL_TEXT_MAX} characters.`;
    }
    if (act.length > REPORT_OPTIONAL_TEXT_MAX) {
      errors.actualBehavior = `Must be at most ${REPORT_OPTIONAL_TEXT_MAX} characters.`;
    }
  }

  return errors;
}

export function hasFieldErrors(errors: ReportFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Builds the wire payload with normalized strings and client metadata.
 */
export function buildReportPayload(
  input: ReportFormInput,
  meta: { hashRoute: string; userAgent: string; appVersion: string; createdAt?: string }
): ReportPayload {
  const base: ReportFormInput = {
    category: input.category,
    title: trimToMax(input.title, REPORT_TITLE_MAX),
    description: trimToMax(input.description, REPORT_DESCRIPTION_MAX)
  };

  if (input.category === "bug") {
    base.stepsToReproduce = trimToMax(input.stepsToReproduce ?? "", REPORT_OPTIONAL_TEXT_MAX);
    base.expectedBehavior = trimToMax(input.expectedBehavior ?? "", REPORT_OPTIONAL_TEXT_MAX);
    base.actualBehavior = trimToMax(input.actualBehavior ?? "", REPORT_OPTIONAL_TEXT_MAX);
    base.severity = input.severity;
  }

  return {
    ...base,
    hashRoute: meta.hashRoute,
    userAgent: meta.userAgent,
    appVersion: meta.appVersion,
    createdAt: meta.createdAt ?? new Date().toISOString()
  };
}
