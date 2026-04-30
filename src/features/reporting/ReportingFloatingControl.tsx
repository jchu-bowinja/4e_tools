import { useEffect, useId, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "../../appVersion";
import {
  REPORT_DESCRIPTION_MAX,
  REPORT_TITLE_MAX,
  emptyReportForm,
  validateReportForm,
  type BugSeverity,
  type ReportCategory,
  type ReportFormInput
} from "./model";
import { submitReport } from "./submitReport";

export interface ReportingUiColors {
  text: string;
  mutedText: string;
  errorText: string;
  toggleBackground: string;
  toggleBorder: string;
  surfaceBackground: string;
  headerBorder: string;
}

const controlButtonStyle = {
  position: "fixed" as const,
  bottom: "1.25rem",
  right: "1.25rem",
  zIndex: 45,
  borderRadius: "999px",
  padding: "0.65rem 1rem",
  fontWeight: 600,
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.18)"
};

function mergeFieldErrors(
  a: Partial<Record<keyof ReportFormInput | string, string>>,
  b: Partial<Record<string, string>> | undefined
): Partial<Record<keyof ReportFormInput | string, string>> {
  if (!b) return { ...a };
  return { ...a, ...b };
}

export function ReportingFloatingControl(props: {
  getHashRoute: () => string;
  colors: ReportingUiColors;
}): JSX.Element {
  const { getHashRoute, colors } = props;
  const dialogId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReportFormInput>(() => emptyReportForm("feedback"));
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ReportFormInput, string>>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const isBug = form.category === "bug";

  const fieldStyle = useMemo(
    () => ({
      display: "flex" as const,
      flexDirection: "column" as const,
      gap: "0.35rem",
      marginBottom: "0.75rem"
    }),
    []
  );

  /** Keep React `open` in sync with `<dialog>` (Escape / backdrop closes natively). */
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    function onDialogClose(): void {
      setOpen(false);
      setSubmitState("idle");
      setBanner(null);
      setFormErrors({});
      setForm(emptyReportForm("feedback"));
      openerRef.current?.focus?.();
      openerRef.current = null;
    }
    el.addEventListener("close", onDialogClose);
    return () => el.removeEventListener("close", onDialogClose);
  }, []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
      }
      const focusTarget = el.querySelector<HTMLElement>(
        'button[type="submit"], input, textarea, select, button'
      );
      focusTarget?.focus();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  function closeModal(): void {
    setOpen(false);
  }

  async function handleSubmit(ev: React.FormEvent): Promise<void> {
    ev.preventDefault();
    setBanner(null);

    const nextErrors = validateReportForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setBanner({ kind: "error", text: "Fix the fields below and try again." });
      return;
    }

    setSubmitState("submitting");

    const result = await submitReport(form, {
      hashRoute: getHashRoute() || window.location.pathname + window.location.search + window.location.hash,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      appVersion: APP_VERSION
    });

    if (result.ok) {
      setSubmitState("success");
      setBanner({ kind: "info", text: `Thanks — your report was submitted (reference ${result.id}).` });
      setForm(emptyReportForm(form.category));
      setFormErrors({});
      return;
    }

    setSubmitState("idle");

    if (result.kind === "client_validation") {
      setFormErrors(mergeFieldErrors({}, result.fieldErrors));
      setBanner({ kind: "error", text: "Fix the highlighted fields." });
      return;
    }

    if (result.kind === "server" && result.fieldErrors) {
      setFormErrors(mergeFieldErrors({}, result.fieldErrors));
    }

    if (result.kind === "network") {
      setBanner({
        kind: "error",
        text: `${result.message} If you are offline or this is production static hosting, the report API may be unavailable — try again from the dev server.`
      });
      return;
    }

    if (result.kind === "server") {
      setBanner({
        kind: "error",
        text: `${result.message} (${String(result.status)})`
      });
      return;
    }

    setBanner({ kind: "error", text: result.message });
  }

  function setCategory(next: ReportCategory): void {
    setForm((f) =>
      next === "bug"
        ? { ...f, category: next, severity: f.severity ?? "medium" }
        : {
            ...f,
            category: next,
            stepsToReproduce: "",
            expectedBehavior: "",
            actualBehavior: "",
            severity: undefined
          }
    );
    setFormErrors({});
    setBanner(null);
  }

  return (
    <>
      <button
        type="button"
        className="report-fab"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        title="Submit feedback or a bug report"
        onClick={() => {
          openerRef.current = document.activeElement as HTMLElement | null;
          setBanner(null);
          setFormErrors({});
          setSubmitState("idle");
          setOpen(true);
        }}
        style={{
          ...controlButtonStyle,
          backgroundColor: colors.toggleBackground,
          borderColor: colors.toggleBorder,
          color: colors.text
        }}
      >
        Feedback
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        style={{
          border: `1px solid ${colors.headerBorder}`,
          borderRadius: "12px",
          padding: "1.25rem",
          backgroundColor: colors.surfaceBackground,
          color: colors.text,
          width: "min(100vw - 2rem, 32rem)",
          maxHeight: "min(90vh, 560px)",
          overflow: "hidden",
          margin: "auto",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.25)"
        }}
      >
        <div style={{ maxHeight: "calc(min(90vh, 560px) - 2.5rem)", overflowY: "auto" }}>
          <h2 id={titleId} style={{ margin: "0 0 0.75rem", fontSize: "1.15rem" }}>
            Feedback &amp; bug reports
          </h2>

          <p style={{ margin: "0 0 0.85rem", color: colors.mutedText, fontSize: "0.95rem", lineHeight: 1.45 }}>
            Submit feedback or bug reports. Reports include this page&apos;s route, app version, and browser metadata to
            help reproduce issues.
          </p>

          {banner ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                marginBottom: "0.85rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "8px",
                border: `1px solid ${colors.toggleBorder}`,
                backgroundColor:
                  banner.kind === "error" ? "rgba(220, 38, 38, 0.08)" : "rgba(34, 197, 94, 0.1)",
                color: banner.kind === "error" ? colors.errorText : colors.text,
                fontSize: "0.9rem"
              }}
            >
              {banner.text}
            </div>
          ) : null}

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={fieldStyle}>
              <label htmlFor={`${dialogId}-category`}>Type</label>
              <select
                id={`${dialogId}-category`}
                value={form.category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${colors.toggleBorder}`,
                  backgroundColor: colors.toggleBackground,
                  color: colors.text
                }}
              >
                <option value="feedback">Feedback</option>
                <option value="bug">Bug report</option>
              </select>
            </div>

            <div style={fieldStyle}>
              <label htmlFor={`${dialogId}-title`}>Title (required)</label>
              <input
                id={`${dialogId}-title`}
                type="text"
                maxLength={REPORT_TITLE_MAX}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoComplete="off"
                aria-invalid={formErrors.title != null ? true : undefined}
                aria-describedby={formErrors.title ? `${dialogId}-title-err` : undefined}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${formErrors.title ? colors.errorText : colors.toggleBorder}`,
                  backgroundColor: colors.toggleBackground,
                  color: colors.text
                }}
              />
              {formErrors.title ? (
                <span id={`${dialogId}-title-err`} style={{ fontSize: "0.85rem", color: colors.errorText }}>
                  {formErrors.title}
                </span>
              ) : (
                <span style={{ fontSize: "0.82rem", color: colors.mutedText }}>
                  {`${form.title.trim().length} / ${REPORT_TITLE_MAX}`}
                </span>
              )}
            </div>

            <div style={fieldStyle}>
              <label htmlFor={`${dialogId}-description`}>Description (required)</label>
              <textarea
                id={`${dialogId}-description`}
                rows={5}
                maxLength={REPORT_DESCRIPTION_MAX}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                aria-invalid={formErrors.description != null ? true : undefined}
                aria-describedby={formErrors.description ? `${dialogId}-desc-err` : undefined}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${formErrors.description ? colors.errorText : colors.toggleBorder}`,
                  backgroundColor: colors.toggleBackground,
                  color: colors.text,
                  resize: "vertical" as const,
                  minHeight: "4.5rem"
                }}
              />
              {formErrors.description ? (
                <span id={`${dialogId}-desc-err`} style={{ fontSize: "0.85rem", color: colors.errorText }}>
                  {formErrors.description}
                </span>
              ) : (
                <span style={{ fontSize: "0.82rem", color: colors.mutedText }}>
                  {`${form.description.trim().length} / ${REPORT_DESCRIPTION_MAX}`}
                </span>
              )}
            </div>

            {isBug ? (
              <>
                <div style={fieldStyle}>
                  <label htmlFor={`${dialogId}-severity`}>Severity (optional)</label>
                  <select
                    id={`${dialogId}-severity`}
                    value={form.severity ?? "medium"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, severity: e.target.value as BugSeverity }))
                    }
                    style={{
                      padding: "0.45rem",
                      borderRadius: "6px",
                      border: `1px solid ${colors.toggleBorder}`,
                      backgroundColor: colors.toggleBackground,
                      color: colors.text
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label htmlFor={`${dialogId}-steps`}>Steps to reproduce</label>
                  <textarea
                    id={`${dialogId}-steps`}
                    rows={3}
                    maxLength={4000}
                    value={form.stepsToReproduce ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, stepsToReproduce: e.target.value }))}
                    aria-invalid={formErrors.stepsToReproduce != null ? true : undefined}
                    placeholder="Optional but helpful."
                    style={{
                      padding: "0.45rem",
                      borderRadius: "6px",
                      border: `1px solid ${formErrors.stepsToReproduce ? colors.errorText : colors.toggleBorder}`,
                      backgroundColor: colors.toggleBackground,
                      color: colors.text,
                      resize: "vertical" as const,
                      minHeight: "3.5rem"
                    }}
                  />
                  {formErrors.stepsToReproduce ? (
                    <span style={{ fontSize: "0.85rem", color: colors.errorText }}>{formErrors.stepsToReproduce}</span>
                  ) : null}
                </div>
                <div style={fieldStyle}>
                  <label htmlFor={`${dialogId}-expected`}>Expected behavior</label>
                  <textarea
                    id={`${dialogId}-expected`}
                    rows={2}
                    maxLength={4000}
                    value={form.expectedBehavior ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, expectedBehavior: e.target.value }))}
                    aria-invalid={formErrors.expectedBehavior != null ? true : undefined}
                    style={{
                      padding: "0.45rem",
                      borderRadius: "6px",
                      border: `1px solid ${formErrors.expectedBehavior ? colors.errorText : colors.toggleBorder}`,
                      backgroundColor: colors.toggleBackground,
                      color: colors.text,
                      resize: "vertical" as const
                    }}
                  />
                  {formErrors.expectedBehavior ? (
                    <span style={{ fontSize: "0.85rem", color: colors.errorText }}>{formErrors.expectedBehavior}</span>
                  ) : null}
                </div>
                <div style={fieldStyle}>
                  <label htmlFor={`${dialogId}-actual`}>Actual behavior</label>
                  <textarea
                    id={`${dialogId}-actual`}
                    rows={2}
                    maxLength={4000}
                    value={form.actualBehavior ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, actualBehavior: e.target.value }))}
                    aria-invalid={formErrors.actualBehavior != null ? true : undefined}
                    style={{
                      padding: "0.45rem",
                      borderRadius: "6px",
                      border: `1px solid ${formErrors.actualBehavior ? colors.errorText : colors.toggleBorder}`,
                      backgroundColor: colors.toggleBackground,
                      color: colors.text,
                      resize: "vertical" as const
                    }}
                  />
                  {formErrors.actualBehavior ? (
                    <span style={{ fontSize: "0.85rem", color: colors.errorText }}>{formErrors.actualBehavior}</span>
                  ) : null}
                </div>
              </>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: `1px solid ${colors.headerBorder}`
              }}
            >
              <button
                type="button"
                style={{
                  backgroundColor: colors.toggleBackground,
                  borderColor: colors.toggleBorder,
                  color: colors.text,
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  cursor: "pointer"
                }}
                onClick={() => closeModal()}
              >
                {submitState === "success" ? "Close" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitState === "submitting" || submitState === "success"}
                style={{
                  backgroundColor: colors.text,
                  borderColor: colors.text,
                  color: colors.surfaceBackground,
                  padding: "0.45rem 0.85rem",
                  borderRadius: "6px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  cursor: submitState === "submitting" || submitState === "success" ? "not-allowed" : "pointer",
                  opacity: submitState === "submitting" || submitState === "success" ? 0.65 : 1
                }}
              >
                {submitState === "submitting" ? "Submitting…" : submitState === "success" ? "Submitted" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
