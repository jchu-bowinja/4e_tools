import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname);

function parseMonsterTemplatePastePlugin(): import("vite").Plugin {
  return {
    name: "parse-monster-template-paste",
    configureServer(server) {
      server.middlewares.use("/api/parse-monster-template-paste", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => {
          chunks.push(c);
        });
        req.on("end", () => {
          let body: { text?: string; templateNameHint?: string };
          try {
            body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "invalid JSON body" }));
            return;
          }
          const text = body.text ?? "";
          const hint = body.templateNameHint?.trim() ?? "";
          const pyScript = join(projectRoot, "tools", "etl", "parse_pasted_monster_template_cli.py");
          const args = [pyScript];
          if (hint) args.push(hint);
          const proc = spawn("python", args, {
            cwd: projectRoot,
            windowsHide: true
          });
          let stdout = "";
          let stderr = "";
          proc.stdout?.on("data", (d: Buffer) => {
            stdout += d.toString("utf8");
          });
          proc.stderr?.on("data", (d: Buffer) => {
            stderr += d.toString("utf8");
          });
          proc.stdin.write(text, "utf8");
          proc.stdin.end();
          proc.on("error", (err: NodeJS.ErrnoException) => {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  err.code === "ENOENT"
                    ? "Python not found on PATH. Paste import falls back to built-in parser."
                    : String(err.message ?? err)
              })
            );
          });
          proc.on("close", (code: number | null) => {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            if (code !== 0) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  ok: false,
                  error: stderr.trim() || `Python exited with code ${code ?? "?"}`
                })
              );
              return;
            }
            res.end(stdout);
          });
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), parseMonsterTemplatePastePlugin()]
});
