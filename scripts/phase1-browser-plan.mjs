import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function phase1BrowserPlan() {
  const catalog = ["tests/e2e/store-product-catalog.spec.ts", "tests/e2e/catalog-administration.spec.ts"];
  const employee = ["tests/e2e/business-employee-access.spec.ts"];
  const common = ["--project=chromium", "--retries=0", "--workers=1"];
  return [
    { name: "catalog-1440", expectedTests: 2, args: [...catalog, "--grep=1440px", ...common] },
    { name: "catalog-both", expectedTests: 4, args: [...catalog, ...common] },
    { name: "employee-1440", expectedTests: 1, args: [...employee, "--grep=1440px", ...common] },
    { name: "employee-both", expectedTests: 2, args: [...employee, ...common] },
    { name: "full-chromium", expectedTests: 88, args: [...common] },
  ];
}

export function browserStagePassed(stage, exitCode, stats) {
  return exitCode === 0 && stats?.expected === stage.expectedTests && stats?.unexpected === 0 && stats?.skipped === 0 && stats?.flaky === 0;
}

export function runPhase1BrowserPlan(env) {
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Browser acceptance requires an exact checkout SHA.");
  const records = [];
  mkdirSync("output/production-closure", { recursive: true });
  for (const stage of phase1BrowserPlan()) {
    const args = [path.join("node_modules", "playwright", "cli.js"), "test", ...stage.args, `--output=test-results/${stage.name}`, "--reporter=list,json"];
    const reportPath = path.resolve(`output/production-closure/browser-${stage.name}.json`);
    const started = Date.now();
    console.log(`PHASE_1_BROWSER_STAGE ${stage.name} SHA=${sha} COMMAND=${process.execPath} ${args.join(" ")}`);
    const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath }, stdio: "inherit", shell: false });
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
