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
  const counts = line => {
    const result = { passed: 0, failed: 0, skipped: 0, todo: 0, pending: 0, flaky: 0 };
    for (const match of line.matchAll(/\b(\d+)\s+(passed|failed|skipped|todo|pending|flaky)\b/g)) result[match[2]] += Number(match[1]);
    return result;
  };
  for (const line of plain.split(/\r?\n/)) {
    if (/^\s*Test Files\s+/.test(line)) files = counts(line);
    else if (/^\s*Tests\s+/.test(line)) executions.push({ runner: "vitest", testFiles: files, ...counts(line) });
    else if (/^\s*Running \d+ tests? using/.test(line)) {
      browser = { runner: "playwright", testFiles: null, ...counts("") };
      executions.push(browser);
    } else if (browser && /^\s*\d+\s+(passed|failed|skipped|flaky)\b/.test(line)) {
      const current = counts(line);
      for (const key of ["passed", "failed", "skipped", "flaky"]) browser[key] += current[key];
    }
  }
  const last = executions.at(-1);
  return { testFilesPassed: last?.testFiles?.passed ?? null, testsPassed: last?.passed ?? null, testsFailed: last?.failed ?? null, testsSkipped: last ? last.skipped + last.todo + last.pending : null, testsFlaky: last?.flaky ?? null, executions };
}
