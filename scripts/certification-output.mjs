export function hasSkippedCriticalTests(output) {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  if (/\b[1-9]\d*\s+(?:skipped|todo|pending)\b/i.test(plain)) return true;
  return plain.split(/\r?\n/).some((line) => {
    // Gate 4 reports the number of markers discovered by its static audit.
    // Its explicit zero is evidence of no skips, not an executed skip marker.
    if (/^\s*Runtime \[SKIP_TEST\] markers: 0\s*$/.test(line)) return false;
    return /\[SKIP_(?:DB_EXECUTION|TEST)\]/.test(line);
  });
}

export function hasFlakyCriticalTests(output) {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  return /\b[1-9]\d*\s+flaky\b/i.test(plain);
}

export function verifyCertificationHead(actual, expected = actual) {
  if (!/^[a-f0-9]{40}$/.test(actual ?? "") || !/^[a-f0-9]{40}$/.test(expected ?? "") || actual !== expected) throw new Error("Certification checkout does not match the requested exact head SHA.");
  return actual;
}

export function certificationTestCounts(output) {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const executions = [];
  let files = null;
  let browser = null;
  const playwrightProgress = { passedAttempts: 0, failedAttempts: 0, skippedAttempts: 0, flakyAttempts: 0, completedAttempts: 0 };
  let hasPlaywrightProgress = false;
  const counts = line => {
    const result = { passed: 0, failed: 0, skipped: 0, todo: 0, pending: 0, flaky: 0 };
    for (const match of line.matchAll(/\b(\d+)\s+(passed|failed|skipped|todo|pending|flaky)\b/g)) result[match[2]] += Number(match[1]);
    const total = line.match(/\((\d+)\)/);
    result.expected = total ? Number(total[1]) : null;
    return result;
  };
  for (const line of plain.split(/\r?\n/)) {
    if (/^\s*Test Files\s+/.test(line)) files = counts(line);
    else if (/^\s*Tests\s+/.test(line)) executions.push({ runner: "vitest", testFiles: files, ...counts(line) });
    else if (/^\s*Running \d+ tests? using/.test(line)) {
      const expected = Number(line.match(/^\s*Running (\d+) tests? using/)?.[1]);
      browser = { runner: "playwright", testFiles: null, ...counts(""), expected, hasFinalSummary: false };
      executions.push(browser);
    } else if (browser && /^\s*\d+\s+(passed|failed|skipped|flaky)\b/.test(line)) {
      const current = counts(line);
      for (const key of ["passed", "failed", "skipped", "flaky"]) browser[key] += current[key];
      browser.hasFinalSummary = true;
    }

    // Playwright's list reporter emits one completed-result row per attempt
    // when stdout is non-interactive. Preserve those rows for timed-out runs
    // that never reach the final summary/JSON report. These are attempts,
    // rather than unique tests, because a retried test can produce two rows.
    const row = line.match(/^\s{2}(✓|✘|x|ok|-)\s+\d+\s+(.+)$/);
    if (row) {
      hasPlaywrightProgress = true;
      const [, mark, detail] = row;
      if (mark === "✓" || mark === "ok") playwrightProgress.passedAttempts++;
      else if (mark === "✘" || mark === "x") playwrightProgress.failedAttempts++;
      else playwrightProgress.skippedAttempts++;
      if (/\(retry #\d+\)/.test(detail)) playwrightProgress.flakyAttempts++;
      playwrightProgress.completedAttempts++;
    }
  }
  const last = executions.at(-1);
  const testsExecuted = last && (last.runner !== "playwright" || last.hasFinalSummary)
    ? last.passed + last.failed + last.skipped + last.todo + last.pending + last.flaky
    : null;
  return {
    testFilesPassed: last?.testFiles?.passed ?? null,
    testsExpected: last?.expected ?? null,
    testsExecuted,
    testsPassed: last?.passed ?? null,
    testsFailed: last?.failed ?? null,
    testsSkipped: last ? last.skipped + last.todo + last.pending : null,
    testsFlaky: last?.flaky ?? null,
    playwrightProgress: hasPlaywrightProgress ? playwrightProgress : null,
    executions,
  };
}

export function certificationEnvironmentProfile(env = process.env, command = "") {
  let databaseHostClass = "unset";
  if (env.DATABASE_URL) {
    try {
      const host = new URL(env.DATABASE_URL).hostname.toLowerCase();
      databaseHostClass = host === "localhost" || host === "127.0.0.1" || host === "::1" ? "loopback" : "configured-non-loopback";
    } catch {
      databaseHostClass = "configured-invalid-url";
    }
  }

  return {
    commandIsolation: command === "test:e2e" ? "disposable-compose-runner" : command === "build:e2e-host" ? "sanitized-host-standalone-image-build" : "command-specific",
    nodeEnvironment: ["development", "test", "production"].includes(env.NODE_ENV) ? env.NODE_ENV : "unset-or-other",
    runtimeEnvironment: ["development", "test", "e2e", "production"].includes(env.KT_RUNTIME_ENV) ? env.KT_RUNTIME_ENV : "unset-or-other",
    networkDisabled: env.KT_NETWORK_DISABLED === "true",
    databaseHostClass,
    emailProvider: env.EMAIL_PROVIDER === "console" ? "console" : "unset-or-other",
    paystackMode: env.PAYSTACK_MODE === "test" ? "test" : env.PAYSTACK_ACTIVE === "false" ? "disabled" : "unset-or-other",
  };
}
