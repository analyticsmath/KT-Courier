import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
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
