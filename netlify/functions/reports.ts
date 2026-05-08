/**
 * Netlify Function: POST /api/reports (via redirect in netlify.toml).
 *
 * Validates the JSON body using the shared validator that the dev-server
 * Vite plugin uses, then creates a GitHub issue in the repo configured by
 * env vars. Response shape matches what `submitReport.ts` and the dev
 * plugin produce, so the client needs no changes.
 *
 * Required env vars (set in the Netlify site UI → Site configuration → Environment variables):
 *   GITHUB_REPO    — "owner/repo" of the repo that should receive issues
 *   GITHUB_TOKEN   — fine-grained PAT scoped to that repo with
 *                    "Issues: Read and write" permission
 * Optional:
 *   GITHUB_LABELS  — comma-separated extra label names to attach in addition
 *                    to the type label (bug / enhancement / documentation /
 *                    question). All labels must already exist on the repo,
 *                    otherwise GitHub returns 422.
 */

import { formatReportIssueTitle, type ReportPayload } from "../../src/features/reporting/model";
import { parseReportBodyJson } from "../../src/features/reporting/validatePayload";

const MAX_BODY_BYTES = 96_384;

interface CreatedIssue {
  number: number;
  html_url: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

/** Defang stray ``` runs so user content can't break out of fenced blocks. */
function fenceSafe(s: string): string {
  return s.replace(/```/g, "``\u200B`");
}

function buildIssue(payload: ReportPayload): { title: string; body: string; labels: string[] } {
  const isBug = payload.category === "bug";
  const title = formatReportIssueTitle(payload);

  const lines: string[] = [];
  lines.push(
    `**Category:** ${payload.category}` +
      (isBug && payload.severity ? `  ·  **Severity:** ${payload.severity}` : "")
  );
  lines.push("");
  lines.push("### Description");
  lines.push("");
  lines.push(fenceSafe(payload.description));

  if (isBug) {
    if (payload.stepsToReproduce) {
      lines.push("");
      lines.push("### Steps to reproduce");
      lines.push("");
      lines.push(fenceSafe(payload.stepsToReproduce));
    }
    if (payload.expectedBehavior) {
      lines.push("");
      lines.push("### Expected behavior");
      lines.push("");
      lines.push(fenceSafe(payload.expectedBehavior));
    }
    if (payload.actualBehavior) {
      lines.push("");
      lines.push("### Actual behavior");
      lines.push("");
      lines.push(fenceSafe(payload.actualBehavior));
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("**Environment**");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| App version | \`${payload.appVersion}\` |`);
  lines.push(`| Route | \`${payload.hashRoute}\` |`);
  lines.push(`| User agent | \`${payload.userAgent}\` |`);
  lines.push(`| Submitted at | \`${payload.createdAt}\` |`);

  const envLabels = process.env.GITHUB_LABELS;
  const extra =
    typeof envLabels === "string" && envLabels.trim().length > 0
      ? envLabels
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  const labels = [...new Set([payload.category, ...extra])];

  return { title, body: lines.join("\n"), labels };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" });
  }

  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { ok: false, error: "payload_too_large" });
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const parsed = parseReportBodyJson(json);
  if (parsed.status !== 200) {
    return jsonResponse(400, parsed.body);
  }

  const repo = process.env.GITHUB_REPO?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!repo || !token) {
    return jsonResponse(503, {
      ok: false,
      error: "not_configured",
      fields: { _root: "Server is missing GITHUB_REPO or GITHUB_TOKEN env var." }
    });
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return jsonResponse(503, {
      ok: false,
      error: "invalid_repo",
      fields: { _root: "GITHUB_REPO must be in 'owner/repo' format." }
    });
  }

  const { title, body, labels } = buildIssue(parsed.payload);

  let ghRes: Response;
  try {
    ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "4e-builder-reports-fn"
      },
      body: JSON.stringify({
        title,
        body,
        ...(labels.length > 0 ? { labels } : {})
      })
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonResponse(502, {
      ok: false,
      error: "github_unreachable",
      fields: { _root: message }
    });
  }

  if (!ghRes.ok) {
    const text = await ghRes.text().catch(() => "");
    return jsonResponse(502, {
      ok: false,
      error: "github_error",
      fields: { _root: `GitHub responded ${String(ghRes.status)}: ${text.slice(0, 500)}` }
    });
  }

  const ghJson = (await ghRes.json().catch(() => null)) as CreatedIssue | null;
  if (!ghJson || typeof ghJson.number !== "number") {
    return jsonResponse(502, { ok: false, error: "github_invalid_response" });
  }

  return jsonResponse(200, { ok: true, id: `#${String(ghJson.number)}` });
};
