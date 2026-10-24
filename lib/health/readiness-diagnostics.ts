/** Logs only operator-safe codes, not values. Readiness HTTP bodies deliberately
 * remain minimal; operational details are available from authenticated admin APIs. */
type ReadinessSnapshot = Readonly<{
  databaseReachable: boolean;
  redisConnected: boolean;
  blockedCodes: readonly string[];
}>;

export function createReadinessWarningReporter(
  emit: (line: string) => void = console.warn,
  now: () => number = Date.now,
): (snapshot: ReadinessSnapshot) => void {
  let lastSignature = "";
  let lastLoggedAt = Number.NEGATIVE_INFINITY;
  return (snapshot) => {
    // Configuration issue codes are fixed enums owned by the application. Still
    // filter defensively so no accidental raw provider error enters logs.
    const reasons = [...new Set(snapshot.blockedCodes.filter((value) => /^[A-Z][A-Z0-9_]{2,63}$/.test(value)))].sort();
    const payload = {
      event: "readiness.blocked",
      database: snapshot.databaseReachable ? "reachable" : "unreachable",
      redis: snapshot.redisConnected ? "connected" : "unreachable",
      reasons,
    };
    const signature = JSON.stringify(payload);
    const current = now();
    if (signature === lastSignature && current - lastLoggedAt < 5 * 60_000) return;
    lastSignature = signature;
    lastLoggedAt = current;
    emit(signature);
  };
}

export const reportBlockedReadiness = createReadinessWarningReporter();
