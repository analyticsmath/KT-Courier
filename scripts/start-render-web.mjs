import { spawn } from "node:child_process";

const children = new Set();
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { stopping = true; for (const child of children) child.kill(signal); });
function run(args, environment = process.env, longRunning = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: environment });
    children.add(child);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      children.delete(child);
      if ((code === 0 && (!longRunning || stopping)) || stopping) resolve();
      else reject(new Error(`Child process failed (${signal ?? code})`));
    });
  });
}
try {
  // Avoid session advisory locks through a pooler when no migration is pending.
  try { await run(["node_modules/prisma/build/index.js", "migrate", "status"]); }
  catch { await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], { ...process.env, DATABASE_URL: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL }); }
  if (process.env.KT_RENDER_LEGACY_REHEARSAL === "true") await run(["--max-old-space-size=192", "--import", "tsx", "scripts/legacy-6ammart/bootstrap-render.ts"]);
  if (!stopping) {
    const runtimeEnvironment = { ...process.env, KT_DATABASE_CLASSIFICATION: "production" };
    const services = [];
    if (process.env.KT_RUN_PROCESSORS_IN_WEB === "true") services.push(run(["--max-old-space-size=128", "--import", "tsx", "scripts/production-processors.ts"], { ...runtimeEnvironment, KT_PROCESSOR_HTTP_DISABLED: "true" }, true));
    services.push(run(["--max-old-space-size=192", "server.js"], runtimeEnvironment, true));
    await Promise.all(services);
  }
} catch {
  console.error("Render startup stopped because a required stage failed.");
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = stopping ? 0 : 1;
}
