import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function phase1BrowserPlan(fullTests = null) {
  const catalog = ["tests/e2e/store-product-catalog.spec.ts", "tests/e2e/catalog-administration.spec.ts"];
  const employee = ["tests/e2e/business-employee-access.spec.ts"];
  const common = ["--project=chromium", "--retries=0", "--workers=1"];
  return [
    { name: "storefront-variant-target", expectedTests: 1, args: ["tests/e2e/storefront-browsing.spec.ts", "--grep=product detail page displays store", ...common] },
    { name: "storefront-product-detail", expectedTests: 4, args: ["tests/e2e/storefront-product-detail.spec.ts", ...common] },
    { name: "catalog-1440", expectedTests: 2, args: [...catalog, "--grep=1440px", ...common] },
    { name: "catalog-both", expectedTests: 4, args: [...catalog, ...common] },
    { name: "employee-1440", expectedTests: 1, args: [...employee, "--grep=1440px", ...common] },
    { name: "employee-both", expectedTests: 2, args: [...employee, ...common] },
    { name: "full-chromium", expectedTests: fullTests, args: [...common] },
  ];
}

export function browserStagePassed(stage, exitCode, stats) {
  return Number.isSafeInteger(stage.expectedTests) && stage.expectedTests > 0 && exitCode === 0 && stats?.expected === stage.expectedTests && stats?.unexpected === 0 && stats?.skipped === 0 && stats?.flaky === 0;
}

export function discoveredBrowserTests(report) {
  const count = suites => suites.reduce((total, suite) => total + (suite.specs ?? []).reduce((n, spec) => n + (spec.tests ?? []).length, 0) + count(suite.suites ?? []), 0);
  const total = count(report.suites ?? []);
  if (!Number.isSafeInteger(total) || total < 1 || report.errors?.length) throw new Error("Full Chromium discovery is missing or invalid.");
  return total;
}

export function runPhase1BrowserPlan(env) {
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Browser acceptance requires an exact checkout SHA.");
  const records = [];
  mkdirSync("output/production-closure", { recursive: true });
  const discoveryPath = path.resolve("output/production-closure/browser-full-discovery.json");
  const discovery = spawnSync(process.execPath, [path.join("node_modules", "playwright", "cli.js"), "test", "--project=chromium", "--list", "--reporter=json"], { env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: discoveryPath }, encoding: "utf8", timeout: 60_000 });
  if (discovery.status !== 0) throw new Error("Full Chromium discovery failed.");
  const fullTests = discoveredBrowserTests(JSON.parse(readFileSync(discoveryPath, "utf8")));
  for (const stage of phase1BrowserPlan(fullTests)) {
    const args = [path.join("node_modules", "playwright", "cli.js"), "test", ...stage.args, `--output=test-results/${stage.name}`, "--reporter=list,json"];
    const reportPath = path.resolve(`output/production-closure/browser-${stage.name}.json`);
    const started = Date.now();
    console.log(`PHASE_1_BROWSER_STAGE ${stage.name} SHA=${sha} COMMAND=${process.execPath} ${args.join(" ")}`);
    const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath }, stdio: "inherit", shell: false, timeout: 900_000 });
    // Verify executed counts as well as exit status: a narrowed/missing selection
    // cannot silently turn a required stage green.
    let stats;
    try { stats = JSON.parse(readFileSync(reportPath, "utf8")).stats; } catch { /* Missing execution evidence fails closed below. */ }
    const passed = browserStagePassed(stage, result.status, stats);
    const record = { stage: stage.name, commitSha: sha, command: [process.execPath, ...args], exitCode: result.status, expectedTests: stage.expectedTests, testsPassed: stats?.expected ?? null, skipped: stats?.skipped ?? null, flaky: stats?.flaky ?? null, durationMs: Date.now() - started, status: passed ? "PASS" : "FAIL" };
    records.push(record);
    writeFileSync("output/production-closure/phase1-browser-stages.json", JSON.stringify(records, null, 2));
    console.log(`PHASE_1_BROWSER_RESULT ${JSON.stringify(record)}`);
    if (!passed) throw new Error(`Phase 1 browser stage ${stage.name} failed; subsequent stages were not started.`);
  }
}
