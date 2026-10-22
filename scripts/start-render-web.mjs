import { spawn } from "node:child_process";

let child;
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { stopping = true; child?.kill(signal); });
function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Child process failed (${signal ?? code})`)));
  });
}
try {
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  if (process.env.KT_RENDER_LEGACY_REHEARSAL === "true") await run(["--import", "tsx", "scripts/legacy-6ammart/bootstrap-render.ts"]);
  if (!stopping) await run(["server.js"]);
} catch {
  console.error("Render startup stopped because a required stage failed.");
  process.exitCode = stopping ? 0 : 1;
}