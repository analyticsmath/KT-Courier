import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { disposableProviderEnvironment, e2eHostStandaloneImageName } from "./e2e-runner-policy.mjs";

const cwd = process.cwd();
const startedAtMs = Date.now();
const startedAt = new Date(startedAtMs).toISOString();
const outputDirectory = path.resolve(cwd, "output", "production-closure");
mkdirSync(outputDirectory, { recursive: true });
const receiptPath = path.join(outputDirectory, `e2e-host-image-${startedAtMs}-${process.pid}.json`);
const envFiles = readdirSync(cwd).filter((name) => name.startsWith(".env") && !name.endsWith(".example"));
const shaResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
const sourceSha = shaResult.status === 0 ? shaResult.stdout.trim() : null;
const treeResult = spawnSync("git", ["rev-parse", "HEAD^{tree}"], { cwd, encoding: "utf8" });
const sourceTreeSha = treeResult.status === 0 ? treeResult.stdout.trim() : null;
const image = sourceSha && /^[a-f0-9]{40}$/.test(sourceSha) ? e2eHostStandaloneImageName(sourceSha) : null;
const contextDirectory = path.resolve(outputDirectory, `e2e-host-context-${startedAtMs}-${process.pid}`);
const commands = [];
let status = "FAIL";
let failure = null;
let appImageId = null;
let contextCleaned = false;

function run(command, args, options = {}) {
  commands.push([command, ...args]);
  return spawnSync(command, args, {
    cwd: options.cwd ?? cwd,
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

try {
  if (!image || !/^[a-f0-9]{40}$/.test(sourceTreeSha ?? "")) throw new Error("Host standalone image requires an exact source commit and tree SHA.");
  if (shaResult.status !== 0 || treeResult.status !== 0) throw new Error("Could not resolve exact Git source identity.");
  const workingTree = spawnSync("git", ["status", "--porcelain=v1", "-uall"], { cwd, encoding: "utf8" });
  if (workingTree.status !== 0 || workingTree.stdout.trim()) throw new Error("Host standalone image build requires a clean, committed source worktree.");
  if (envFiles.length) throw new Error(`Refusing to build with workspace environment files present: ${envFiles.join(", ")}`);

  const buildEnv = cleanHostBuildEnvironment();
  console.log(`E2E_HOST_BUILD_SOURCE_SHA=${sourceSha} SOURCE_TREE_SHA=${sourceTreeSha}`);
  console.log("E2E_HOST_BUILD_ENV=OS launch variables plus disposable loopback/test-only settings; workspace .env files and inherited provider credentials excluded");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  ensureSuccessful(run(npm, ["run", "build"], { env: buildEnv, shell: process.platform === "win32", timeout: 1_200_000 }), "Host Next standalone build");

  const standalone = path.resolve(cwd, ".next", "standalone");
  const staticAssets = path.resolve(cwd, ".next", "static");
  const publicAssets = path.resolve(cwd, "public");
  const launcher = path.resolve(cwd, "scripts", "e2e-standalone-app.mjs");
  const guard = path.resolve(cwd, "lib", "private-media", "disposable-private-media-policy.ts");
  if (![standalone, staticAssets, publicAssets, launcher, guard].every(existsSync)) throw new Error("Host Next build did not produce the complete standalone runtime inputs.");
  const requiredServerFiles = path.join(standalone, ".next", "required-server-files.json");
  if (!existsSync(requiredServerFiles)) throw new Error("Standalone output is missing required-server-files.json.");

  mkdirSync(contextDirectory, { recursive: false });
  cpSync(standalone, path.join(contextDirectory, "standalone"), { recursive: true, errorOnExist: true });
  cpSync(staticAssets, path.join(contextDirectory, "static"), { recursive: true, errorOnExist: true });
  cpSync(publicAssets, path.join(contextDirectory, "public"), { recursive: true, errorOnExist: true });
  cpSync(launcher, path.join(contextDirectory, "e2e-standalone-app.mjs"));
  cpSync(guard, path.join(contextDirectory, "disposable-private-media-policy.ts"));
  writeFileSync(path.join(contextDirectory, "Dockerfile"), [
    "FROM node:24-bookworm-slim",
    `LABEL org.ktcouriers.e2e.source-sha=\"${sourceSha}\"`,
    "WORKDIR /app",
    "ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000",
    "COPY --chown=node:node standalone/ ./",
    "COPY --chown=node:node static/ ./.next/static/",
    "COPY --chown=node:node public/ ./public/",
    "COPY --chown=node:node e2e-standalone-app.mjs ./scripts/e2e-standalone-app.mjs",
    "COPY --chown=node:node disposable-private-media-policy.ts ./lib/private-media/disposable-private-media-policy.ts",
    "USER node",
    "EXPOSE 3000",
    "CMD [\"node\", \"scripts/e2e-standalone-app.mjs\"]",
    "",
  ].join("\n"));

  const build = run("docker", ["build", "--tag", image, "--file", path.join(contextDirectory, "Dockerfile"), contextDirectory], { timeout: 600_000 });
  ensureSuccessful(build, "Host standalone app image build");
  const inspect = spawnSync("docker", ["image", "inspect", "--format", "{{.Id}}", image], { cwd, encoding: "utf8" });
  if (inspect.status !== 0 || !/^sha256:[a-f0-9]{64}$/.test(inspect.stdout.trim())) throw new Error("Host standalone image was not retrievable after build.");
  appImageId = inspect.stdout.trim();
  const label = spawnSync("docker", ["image", "inspect", "--format", "{{ index .Config.Labels \"org.ktcouriers.e2e.source-sha\" }}", image], { cwd, encoding: "utf8" });
  if (label.status !== 0 || label.stdout.trim() !== sourceSha) throw new Error("Host standalone image source label did not verify.");
  status = "PASS";
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(failure);
} finally {
  const resolvedOutput = path.resolve(outputDirectory);
  const resolvedContext = path.resolve(contextDirectory);
  if (resolvedContext.startsWith(`${resolvedOutput}${path.sep}`) && existsSync(resolvedContext)) {
    try {
      rmSync(resolvedContext, { recursive: true, force: true });
      contextCleaned = true;
    } catch (error) {
      failure = `${failure ? `${failure}; ` : ""}generated context cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      status = "FAIL";
    }
  } else {
    contextCleaned = true;
  }
  const endedAtMs = Date.now();
  const receipt = {
    schemaVersion: 1,
    command: ["npm", "run", "build", "and docker build (generated isolated standalone context)"],
    commitSha: sourceSha,
    sourceTreeSha,
    image,
    appImageId,
    startedAt,
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    commands,
    hostBuildEnvironment: "sanitized; workspace environment files and inherited provider credentials excluded",
    context: "only .next/standalone, .next/static, public, and the disposable app launcher/policy",
    contextCleaned,
    failure,
    status,
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(`E2E_HOST_IMAGE_RECEIPT=${receiptPath}`);
  console.log(`E2E_HOST_IMAGE_RESULT=${JSON.stringify(receipt)}`);
}

process.exitCode = status === "PASS" ? 0 : 1;
