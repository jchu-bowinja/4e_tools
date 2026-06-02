import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import type { Plugin } from "vite";

/** Serve `/generated/*` from the repo `generated/` folder during `npm run dev`. */
export function generatedStaticPlugin(projectRoot: string): Plugin {
  const generatedRoot = normalize(join(projectRoot, "generated"));

  return {
    name: "generated-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/generated/")) {
          next();
          return;
        }
        const relative = normalize(url.slice("/generated/".length));
        if (relative.startsWith("..")) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }
        const filePath = join(generatedRoot, relative);
        if (!filePath.startsWith(generatedRoot) || !existsSync(filePath)) {
          next();
          return;
        }
        const stat = statSync(filePath);
        if (!stat.isFile()) {
          next();
          return;
        }
        if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        createReadStream(filePath).pipe(res);
      });
    }
  };
}
