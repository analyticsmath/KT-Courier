import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { disposableProviderEnvironment } from "./e2e-runner-policy.mjs";

const cwd = process.cwd();
const startedAtMs = Date.now();
const startedAt = new Date(startedAtMs).toISOString();
const outputDirectory = path.resolve(cwd, "output", "production-closure");
mkdirSync(outputDirectory, { recursive: true });
const envFiles = readdirSync(cwd).filter((name) => name.startsWith(".env") && !name.endsWith(".example"));
const shaResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
const sourceSha = shaResult.status === 0 ? shaResult.stdout.trim() : null;
const treeResult = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { cwd, encoding: "utf8" });
const sourceTreeSha = treeResult.status === 0 ? treeResult.stdout.trim() : null;
const manifestPath = sourceSha && /^[a-f0-9]{40}$/.test(sourceSha)
  ? path.join(outputDirectory, `e2e-host-standalone-${sourceSha}.json`)
  : path.join(outputDirectory, `e2e-host-standalone-invalid-${startedAtMs}.json`);
const commands = [];
let status = "FAIL";
let failure = null;
let buildId = null;

function run(command, args, options = {}) {
  commands.push([command, ...args]);
  return spawnSync(command, args, {
    cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: options.shell ?? false,
    stdio: "inherit",
    timeout: options.timeout,
  });
}

function ensureSuccessful(result, label) {
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed (exit=${result.status ?? "null"}, signal=${result.signal ?? "none"}, error=${result.error?.code ?? "none"}).`);
  }
}

function cleanHostBuildEnvironment() {
  const hostKeys = process.platform === "win32"
    ? ["PATH", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ComSpec"]
    : ["PATH", "HOME", "TMPDIR", "TMP", "TEMP"];
  const host = Object.fromEntries(hostKeys.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  return {
    ...disposableProviderEnvironment(host),
    NODE_ENV: "production",
    KT_RUNTIME_ENV: "e2e",
    KT_NETWORK_DISABLED: "true",
    KT_E2E_PRIVATE_MEDIA_LOCAL: "true",
    KT_E2E_PAYSTACK_ACCEPTANCE: "true",
    KT_E2E_NETWORK_INTERNAL: "true",
    DATABASE_URL: "postgresql://kt_phase75_e2e:disposable_only@127.0.0.1:1/kt_phase75_e2e?schema=public",
    SHADOW_DATABASE_URL: "postgresql://kt_phase75_e2e:disposable_only@127.0.0.1:1/kt_phase75_e2e_shadow?schema=public",
    REDIS_URL: "redis://127.0.0.1:1/0",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    APP_URL: "http://localhost:3000",
    ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
    PAYMENT_APP_ORIGIN: "http://localhost:3000",
    EMAIL_PROVIDER: "console",
    PAYSTACK_MODE: "test",
    PAYFAST_MERCHANT_ID: "",
    PAYFAST_MERCHANT_KEY: "",
    PAYFAST_PASSPHRASE: "",
    RESEND_API_KEY: "",
    PRIVATE_MEDIA_STORAGE: "local",
    PRIVATE_MEDIA_LOCAL_DIR: "/tmp/kt-couriers-e2e-private-media",
    CATALOG_MEDIA_STORAGE: "filesystem",
    CATALOG_MEDIA_LOCAL_DIR: "/tmp/kt-couriers-e2e-catalog-media",
    E2E_ROUTE_PROVIDER: "deterministic",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES: "true",
    KT_NEXT_BUILD_CPUS: "1",
    KT_NEXT_BUILD_HEAP_MB: "4096",
    NODE_OPTIONS: "--max-old-space-size=4096",
    NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    KT_E2E_GEOCODE_FIXTURES: JSON.stringify({
      "45 Commission St, Central, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2041, longitude: 28.0473 },
      "10 E2E Pickup Road, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2041, longitude: 28.0473 },
      "45 Commission St, Johannesburg, Gauteng, 2001, South Africa": { latitude: -26.2051, longitude: 28.0483 },
    }),
  };
}

const runningManifest = {
  schemaVersion: 1,
  command: ["npm", "run", "build"],
  commitSha: sourceSha,
  sourceTreeSha,
  startedAt,
  status: "RUNNING",
};
writeFileSync(manifestPath, JSON.stringify(runningManifest, null, 2));

try {
  if (!sourceSha || !/^[a-f0-9]{40}$/.test(sourceSha) || !/^[a-f0-9]{40}$/.test(sourceTreeSha ?? "")) throw new Error("Host Next standalone build requires exact source commit and tree SHAs.");
  if (shaResult.status !== 0 || treeResult.status !== 0) throw new Error("Could not resolve exact Git source identity.");
  const workingTree = spawnSync("git", ["status", "--porcelain=v1", "-uall"], { cwd, encoding: "utf8" });
  if (workingTree.status !== 0 || workingTree.stdout.trim()) throw new Error("Host Next standalone build requires a clean, committed source worktree.");
  if (envFiles.length) throw new Error(`Refusing to build with workspace environment files present: ${envFiles.join(", ")}`);

  console.log(`E2E_HOST_BUILD_SOURCE_SHA=${sourceSha} SOURCE_TREE_SHA=${sourceTreeSha}`);
  console.log("E2E_HOST_BUILD_ENV=OS launch variables plus disposable loopback/test-only settings; workspace .env files and inherited provider credentials excluded");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  ensureSuccessful(run(npm, ["run", "build"], { env: cleanHostBuildEnvironment(), shell: process.platform === "win32", timeout: 1_200_000 }), "Host Next standalone build");

  const standalone = path.resolve(cwd, ".next", "standalone");
  const staticAssets = path.resolve(cwd, ".next", "static");
  const publicAssets = path.resolve(cwd, "public");
  const catalogMedia = path.resolve(cwd, "var", "catalog-media");
  const clientAuthority = path.resolve(cwd, "docs", "client-authority", "2026-10");
  const standaloneInputs = [
    path.join(standalone, "server.js"),
    path.join(standalone, ".next", "required-server-files.json"),
    path.join(standalone, ".next", "BUILD_ID"),
    staticAssets,
    publicAssets,
    catalogMedia,
    clientAuthority,
  ];
  if (!standaloneInputs.every(existsSync)) throw new Error("Host Next build did not produce the complete standalone runtime inputs.");
  buildId = readFileSync(path.join(standalone, ".next", "BUILD_ID"), "utf8").trim();
  if (!buildId) throw new Error("Host standalone build ID is empty.");

  const treeAfterBuild = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { cwd, encoding: "utf8" });
  const statusAfterBuild = spawnSync("git", ["status", "--porcelain=v1", "-uall"], { cwd, encoding: "utf8" });
  if (treeAfterBuild.status !== 0 || treeAfterBuild.stdout.trim() !== sourceTreeSha || statusAfterBuild.status !== 0 || statusAfterBuild.stdout.trim()) {
    throw new Error("Source tree changed while generating the host standalone output.");
  }
  status = "PASS";
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(failure);
} finally {
  const endedAtMs = Date.now();
  const manifest = {
    schemaVersion: 1,
    command: ["npm", "run", "build"],
    commitSha: sourceSha,
    sourceTreeSha,
    nodeVersion: process.version,
    buildId,
    startedAt,
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    commands,
    hostBuildEnvironment: "sanitized; workspace environment files and inherited provider credentials excluded",
    runtimeArtifact: "Next standalone .next output, server.js, static and public; packaged later over the disposable Linux migration image",
    failure,
    status,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`E2E_HOST_STANDALONE_RECEIPT=${manifestPath}`);
  console.log(`E2E_HOST_STANDALONE_RESULT=${JSON.stringify(manifest)}`);
}

process.exitCode = status === "PASS" ? 0 : 1;
