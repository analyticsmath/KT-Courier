import { createServer } from "node:http";
import path from "node:path";
import { createReleaseAuthorityHandler } from "./app.mjs";
import { createDurableFileStore, createPostgresStore } from "./store.mjs";

async function resolveStore(env) {
  const dbUrl = env.RELEASE_AUTHORITY_DATABASE_URL?.trim();
  if (dbUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: dbUrl, max: 10 });
    const store = createPostgresStore({ pool });
    await store.init();
    return { store, closeStore: () => pool.end() };
  }

  const dataDir = env.RELEASE_AUTHORITY_DATA_DIR?.trim() || path.resolve(process.cwd(), "var", "release-authority-data");
  const store = createDurableFileStore(dataDir);
  await store.init();
  return { store, closeStore: async () => {} };
}

export async function startReleaseAuthorityServer(env = process.env) {
  const readToken = env.RELEASE_AUTHORITY_BEARER_TOKEN?.trim() ?? "";
  const adminToken = env.RELEASE_AUTHORITY_ADMIN_TOKEN?.trim() ?? "";
  const host = env.HOST?.trim() || "0.0.0.0";
  const port = Number(env.PORT || 8080);

  const { store, closeStore } = await resolveStore(env);
  const handler = createReleaseAuthorityHandler({ store, readToken, adminToken, env });
  const server = createServer(handler);

  await new Promise((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  async function shutdown() {
    await new Promise((resolve) => server.close(() => resolve()));
    await closeStore();
  }

  return { server, host, port: resolvedPort, shutdown };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain) {
  const instance = await startReleaseAuthorityServer(process.env);
  console.log(`kt-courier-release-authority listening on ${instance.host}:${instance.port}`);
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      void instance.shutdown().then(() => process.exit(0));
    });
  }
}
