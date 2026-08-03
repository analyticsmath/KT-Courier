import os from "node:os";
import process from "node:process";
import { existsSync } from "node:fs";
import { run, runDocker, safeError, safeLog, sanitize } from "./docker-common.mjs";

function section(title) {
  console.log(`\n== ${title} ==`);
}

function reportCommand(label, command, args, options = {}) {
  const result = run(command, args, options);
  const ok = result.status === 0;
  console.log(`${label}: ${ok ? "ok" : "failed"}`);
  if (result.stdout) safeLog(result.stdout);
  if (result.stderr) safeError(result.stderr);
  return ok;
}

function reportDocker(label, args) {
  return reportCommand(label, "docker", args);
}

function reportWindowsPath(label, path) {
  console.log(`${label}: ${existsSync(path) ? "present" : "missing"}`);
}

console.log("KT Couriers Docker doctor");
console.log(`Platform: ${os.platform()} ${os.release()} ${os.arch()}`);

section("Docker CLI");
const dockerCli = reportCommand("docker executable", "docker", ["--version"]);

section("Docker Context");
reportDocker("docker context show", ["context", "show"]);
reportDocker("docker context ls", ["context", "ls"]);
console.log(`DOCKER_HOST env: ${process.env.DOCKER_HOST ? "set/redacted" : "absent"}`);
console.log(`DOCKER_CONTEXT env: ${process.env.DOCKER_CONTEXT ? "set/redacted" : "absent"}`);

section("Docker Engine");
let engineReachable = false;
if (dockerCli) {
  reportDocker("docker version", ["version"]);
  const info = runDocker(["info"]);
  engineReachable = info.status === 0;
  console.log(`docker info: ${engineReachable ? "ok" : "failed"}`);
  if (info.stdout) safeLog(info.stdout);
  if (info.stderr) safeError(info.stderr);
}

section("Docker Compose");
if (dockerCli) {
  reportDocker("docker compose version", ["compose", "version"]);
}

if (os.platform() === "win32") {
  section("Windows Docker Desktop");
  const allUserPath = `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Docker\\Docker\\Docker Desktop.exe`;
  const perUserPath = `${process.env.LOCALAPPDATA ?? ""}\\Programs\\Docker\\Docker\\Docker Desktop.exe`;
  reportWindowsPath("All-user Docker Desktop", allUserPath);
  reportWindowsPath("Per-user Docker Desktop", perUserPath);
  if (dockerCli) {
    reportDocker("docker desktop status", ["desktop", "status"]);
    reportDocker("docker desktop engine ls", ["desktop", "engine", "ls"]);
  }

  section("WSL");
  reportCommand("wsl --status", "wsl", ["--status"]);
  reportCommand("wsl --version", "wsl", ["--version"]);
  reportCommand("wsl -l -v", "wsl", ["-l", "-v"]);
}

if (!engineReachable) {
  console.error(
    sanitize(
      "\nDocker Engine is not reachable. Start Docker Desktop, verify the selected context, and rerun npm run docker:doctor."
    )
  );
  process.exit(1);
}

console.log("\nDocker Engine is reachable.");
