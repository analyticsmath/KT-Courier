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
