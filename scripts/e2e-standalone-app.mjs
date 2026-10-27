import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { stageDisposableCatalogMedia } from "./e2e-catalog-media-startup.mjs";
import { disposableBrowserPrivateMediaAllowed } from "../lib/private-media/disposable-private-media-policy.ts";

// The generated standalone launcher overwrites NODE_ENV with production. This
// disposable-only launcher starts the same optimized server with test storage.
// Production continues to use the generated server.js unchanged.
if (!disposableBrowserPrivateMediaAllowed()) {
  process.stderr.write("Disposable E2E application requires the named network-isolated test environment.\n");
  process.exit(1);
}
try {
  const dir = process.cwd();
  // The optimized image carries the verified demo files under /app/var,
  // while the disposable application writes uploads under its private /tmp.
  // Both must be reachable through the *same* scoped catalog media adapter.
  const writableCatalog = process.env.CATALOG_MEDIA_LOCAL_DIR;
  if (!writableCatalog) throw new Error("Disposable writable catalog media path is missing.");
  stageDisposableCatalogMedia(path.join(dir, "var", "catalog-media"), writableCatalog);
  const { config } = JSON.parse(readFileSync(path.join(dir, ".next", "required-server-files.json"), "utf8"));
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
  const require = createRequire(import.meta.url);
  require("next");
  const { startServer } = require("next/dist/server/lib/start-server");
  await startServer({ dir, isDev: false, config, hostname: "0.0.0.0", port: 3000, allowRetry: false });
} catch {
  process.stderr.write("Disposable E2E application could not start.\n");
  process.exit(1);
}
