import os from "node:os";
import process from "node:process";
import {
  assertSuccess,
  run,
  runCompose,
  runDocker,
  safeError,
  safeLog,
  wait,
  waitForServiceHealth,
} from "./docker-common.mjs";

async function waitForDockerEngine(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = runDocker(["info"]);
    if (result.status === 0) return true;
    await wait(5_000);
  }
  return false;
}

function tryDockerDesktopStart() {
  if (os.platform() !== "win32") return false;

  safeLog("Docker Engine is not reachable; attempting Docker Desktop startup.");
  const cliStart = runDocker(["desktop", "start", "--timeout", "120"]);
  if (cliStart.status === 0) {
    if (cliStart.stdout) safeLog(cliStart.stdout);
    return true;
  }

  if (cliStart.stderr) safeError(cliStart.stderr);

  const candidates = [
    `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\Docker Desktop.exe`,
    `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Docker\\Docker\\Docker Desktop.exe`,
  ];
  const existing = candidates.find((candidate) => candidate && run("powershell", [
    "-NoProfile",
    "-Command",
    `Test-Path -LiteralPath ${JSON.stringify(candidate)}`,
  ]).stdout.trim() === "True");

  if (!existing) return false;

  const started = run("powershell", [
    "-NoProfile",
    "-Command",
    `Start-Process -WindowStyle Hidden -FilePath ${JSON.stringify(existing)}`,
  ]);
  if (started.status !== 0) {
    if (started.stderr) safeError(started.stderr);
    return false;
  }
  return true;
}

async function main() {
  safeLog("Running Docker doctor.");
  const doctor = run(process.execPath, ["scripts/docker-doctor.mjs"]);

  if (doctor.status !== 0) {
    if (doctor.stdout) safeLog(doctor.stdout);
    if (doctor.stderr) safeError(doctor.stderr);

    tryDockerDesktopStart();
    const reachable = await waitForDockerEngine();
    if (!reachable) {
      safeError("Docker Engine did not become reachable after Docker Desktop startup attempt.");
      process.exit(1);
    }
  }

  const secondDoctor = run(process.execPath, ["scripts/docker-doctor.mjs"]);
  if (secondDoctor.status !== 0) {
    if (secondDoctor.stdout) safeLog(secondDoctor.stdout);
    if (secondDoctor.stderr) safeError(secondDoctor.stderr);
    process.exit(secondDoctor.status ?? 1);
  }

  safeLog("Starting Compose PostgreSQL service.");
  assertSuccess(runCompose(["up", "-d", "db"]), "docker compose up db");

  const health = await waitForServiceHealth("db", { timeoutMs: 150_000 });
  if (health !== "healthy") {
    safeError(`PostgreSQL service did not become healthy; final status: ${health}.`);
    process.exit(1);
  }

  safeLog("Ensuring local database role and database match DATABASE_URL.");
  assertSuccess(
    run(process.execPath, ["scripts/ensure-local-db-from-url.mjs"]),
    "ensure local database from DATABASE_URL"
  );

  safeLog("Ensuring local shadow database.");
  assertSuccess(run(process.execPath, ["scripts/ensure-shadow-db.mjs"]), "ensure shadow database");

  safeLog("PostgreSQL is healthy in Docker Compose.");
}

main().catch((error) => {
  safeError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
