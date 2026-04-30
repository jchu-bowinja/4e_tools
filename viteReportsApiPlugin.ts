import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { parseReportBodyJson } from "./src/features/reporting/validatePayload.ts";

const MAX_BODY_BYTES = 96_384;

/** Dev server plugin: POST /api/reports — validates body and appends JSON lines under received_reports/ */
export function reportsApiPlugin(projectRoot: string): Plugin {
  const reportsDir = join(projectRoot, "received_reports");
  const reportsFile = join(reportsDir, "reports.jsonl");

  return {
    name: "reports-api",
    configureServer(server) {
      server.middlewares.use("/api/reports", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        let total = 0;
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => {
          total += c.length;
          if (total <= MAX_BODY_BYTES) {
            chunks.push(c);
          }
        });

        req.on("end", () => {
          if (total > MAX_BODY_BYTES) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "payload_too_large" }));
            return;
          }

          let body: unknown;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "invalid_json" }));
            return;
          }

          const parsed = parseReportBodyJson(body);
          if (parsed.status !== 200) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(parsed.body));
            return;
          }

          const id = randomUUID();
          const receivedAt = new Date().toISOString();
          const record = { id, receivedAt, ...parsed.payload };

          try {
            mkdirSync(reportsDir, { recursive: true });
            appendFileSync(reportsFile, `${JSON.stringify(record)}\n`, "utf8");
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "persist_failed", message }));
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: true, id }));
        });
      });
    }
  };
}
