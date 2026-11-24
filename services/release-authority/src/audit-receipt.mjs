import { createHash } from "node:crypto";
import { DIGEST_PATTERN, SAFE_ID_PATTERN, SHA_PATTERN, canonicalBytes, sha256Hex } from "./security.mjs";

export const AUDIT_RECEIPT_SCHEMA_VERSION = 1;

export const REQUIRED_PROTECTED_AUDIT_TABLES = Object.freeze([
  "User",
  "Store",
  "Address",
  "Order",
  "Payment",
  "PaymentAttempt",
  "PaymentRefund",
  "PaymentWebhookEvent",
  "PaymentVerifiedEventIntent",
  "PaymentReconciliationCase",
  "PaymentReleaseProvenance",
  "PaystackSandboxVerification",
  "PaystackLiveVerification",
  "MarketplaceOrder",
  "MarketplaceStoreOrder",
  "CashOnDelivery",
  "DriverCashDeposit",
  "PrivateMediaObject",
  "StoreEarning",
  "DriverEarning",
  "WithdrawalRequest",
  "CommissionAccrual",
  "LedgerAccount",
  "LedgerJournal",
  "LedgerEntry",
  "Wallet",
  "WalletTransaction",
  "DriverProfile",
  "CatalogProduct",
  "CatalogProductVariant",
  "CatalogCategory",
  "CatalogMediaAsset",
  "StorefrontProductDocument",
  "PaymentMethodPolicy",
  "CommissionPlan",
  "StoreOrderOperationalPolicy",
  "RetentionPolicyVersion",
]);

export const DOCUMENTED_OPERATIONAL_CHANGE_TABLES = Object.freeze([
  "Order",
  "Payment",
  "PaymentAttempt",
  "PaymentRefund",
  "PaymentWebhookEvent",
  "PaymentVerifiedEventIntent",
  "PaymentReconciliationCase",
  "PaymentReleaseProvenance",
  "PaystackSandboxVerification",
  "PaystackLiveVerification",
  "MarketplaceOrder",
  "MarketplaceStoreOrder",
  "CashOnDelivery",
  "DriverCashDeposit",
  "StoreEarning",
  "DriverEarning",
  "LedgerAccount",
  "LedgerJournal",
  "LedgerEntry",
  "Wallet",
  "WalletTransaction",
  "OperationalProcessorRun",
  "SystemSetting",
]);

const DOCUMENTED_OPERATIONAL_SET = new Set(DOCUMENTED_OPERATIONAL_CHANGE_TABLES);

export function computeProtectedSnapshotDigest(protectedTables) {
  if (!protectedTables || typeof protectedTables !== "object" || Array.isArray(protectedTables)) {
    throw Object.assign(new Error("Protected table snapshot map is required."), {
      code: "AUDIT_RECEIPT_INVALID",
      status: 400,
    });
  }
  const ordered = Object.keys(protectedTables)
    .sort()
    .map((key) => [key, protectedTables[key]?.count, protectedTables[key]?.hash]);
  return sha256Hex(canonicalBytes(ordered));
}

export function computeAuditReceiptDigest(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw Object.assign(new Error("Audit receipt object is required."), {
      code: "AUDIT_RECEIPT_INVALID",
      status: 400,
    });
  }
  const body = { ...receipt };
  delete body.receiptDigest;
  return sha256Hex(canonicalBytes(body));
}

function isValidTableSummaryMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return false;
  const entries = Object.entries(map);
  if (entries.length === 0) return false;
  return entries.every(
    ([name, val]) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) &&
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      Number.isInteger(val.count) &&
      val.count >= 0 &&
      typeof val.hash === "string" &&
      DIGEST_PATTERN.test(val.hash),
  );
}

export function evaluateAuditComparison(beforeProtected, afterProtected, options = {}) {
  const documentedList = Array.isArray(options.documentedOperationalChanges)
    ? [...new Set(options.documentedOperationalChanges.map(String))].sort()
    : [];
  const documentedChangeReference =
    typeof options.documentedChangeReference === "string" && SAFE_ID_PATTERN.test(options.documentedChangeReference)
      ? options.documentedChangeReference
      : null;
  const documentedChangeReason =
    typeof options.documentedChangeReason === "string" && options.documentedChangeReason.trim().length >= 10
      ? options.documentedChangeReason.trim()
      : null;
  const documentedChangesAuthorized = options.documentedChangesAuthorized === true;

  if (!beforeProtected || typeof beforeProtected !== "object") {
    return {
      baselinePresent: false,
      unchanged: false,
      eligibleForParity: false,
      changedTables: [],
      addedTables: Object.keys(afterProtected ?? {}).sort(),
      removedTables: [],
      documentedOperationalChanges: documentedList,
      unexpectedChangedTables: [],
      commerceActivityDetected: false,
      documentedChangeReference,
      documentedChangeReason,
      limitations: ["PRE_DEPLOYMENT_BASELINE_ABSENT"],
    };
  }

  const beforeKeys = new Set(Object.keys(beforeProtected));
  const afterKeys = new Set(Object.keys(afterProtected));
  const addedTables = [...afterKeys].filter((k) => !beforeKeys.has(k)).sort();
  const removedTables = [...beforeKeys].filter((k) => !afterKeys.has(k)).sort();
  const changedTables = [];

  for (const key of [...afterKeys].filter((k) => beforeKeys.has(k)).sort()) {
    const b = beforeProtected[key];
    const a = afterProtected[key];
    if (!b || !a || b.count !== a.count || b.hash !== a.hash) {
      changedTables.push(key);
    }
  }

  const unchanged = changedTables.length === 0 && addedTables.length === 0 && removedTables.length === 0;
  const commerceActivityDetected = changedTables.some((table) => DOCUMENTED_OPERATIONAL_SET.has(table));

  const allowedSet = new Set(documentedList.filter((t) => DOCUMENTED_OPERATIONAL_SET.has(t)));
  const unexpectedChangedTables = unchanged
    ? []
    : changedTables.filter((table) => !allowedSet.has(table));

  const authorizedActiveCommerceWindow =
    !unchanged &&
    documentedChangesAuthorized &&
    Boolean(documentedChangeReference) &&
    Boolean(documentedChangeReason) &&
    addedTables.length === 0 &&
    removedTables.length === 0 &&
    changedTables.length > 0 &&
    unexpectedChangedTables.length === 0;

  const limitations = [];
  if (!unchanged && !authorizedActiveCommerceWindow) {
    limitations.push("UNEXPECTED_PROTECTED_TABLE_CHANGES");
  }

  return {
    baselinePresent: true,
    unchanged,
    eligibleForParity: unchanged || authorizedActiveCommerceWindow,
    changedTables,
    addedTables,
    removedTables,
    documentedOperationalChanges: documentedList,
    unexpectedChangedTables,
    commerceActivityDetected,
    documentedChangeReference,
    documentedChangeReason,
    limitations,
  };
}

export function verifyAuditReceipt(receipt, expected = {}) {
  const reject = (code, detail, status = 409) => {
    throw Object.assign(new Error(detail), { code, status });
  };

  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    reject("AUDIT_RECEIPT_INVALID", "Protected-row audit receipt is missing or malformed.", 400);
  }
  if (receipt.schemaVersion !== AUDIT_RECEIPT_SCHEMA_VERSION) {
    reject("AUDIT_RECEIPT_INVALID", "Unsupported audit receipt schemaVersion.", 400);
  }
  if (typeof receipt.receiptReference !== "string" || !SAFE_ID_PATTERN.test(receipt.receiptReference)) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receiptReference is invalid.", 400);
  }
  if (typeof receipt.releaseSha !== "string" || !SHA_PATTERN.test(receipt.releaseSha)) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receipt releaseSha must be a 40-character commit SHA.", 400);
  }
  if (typeof receipt.receiptDigest !== "string" || !DIGEST_PATTERN.test(receipt.receiptDigest)) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receiptDigest must be a 64-character hex digest.", 400);
  }

  const expectedDigest = computeAuditReceiptDigest(receipt);
  if (expectedDigest !== receipt.receiptDigest) {
    reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt cryptographic digest mismatch.", 409);
  }

  // Provenance & least-privilege DB verification
  const dbId = receipt.databaseIdentity;
  if (
    !dbId ||
    typeof dbId.database !== "string" ||
    !dbId.database.trim() ||
    typeof dbId.role !== "string" ||
    !dbId.role.trim() ||
    !["production", "isolated_test"].includes(dbId.classification) ||
    typeof dbId.hostDigest !== "string" ||
    !/^[a-f0-9]{16,64}$/.test(dbId.hostDigest)
  ) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receipt databaseIdentity is incomplete.", 400);
  }
  if (
    dbId.transactionReadOnly !== "on" ||
    dbId.rolsuper !== false ||
    dbId.rolbypassrls !== false ||
    !Array.isArray(dbId.writableTables) ||
    dbId.writableTables.length > 0 ||
    !Array.isArray(dbId.privilegeFindings) ||
    dbId.privilegeFindings.length > 0 ||
    dbId.leastPrivilegeVerified !== true
  ) {
    reject(
      "AUDIT_LEAST_PRIVILEGE_REQUIRED",
      "Audit receipt did not execute under a verified non-superuser, non-bypassrls, read-only role.",
      409,
    );
  }

  // Inventory completeness check
  const inv = receipt.inventory;
  const candidateProtected = receipt.snapshots?.candidateProtected;
  if (!inv || !isValidTableSummaryMap(candidateProtected)) {
    reject("AUDIT_INVENTORY_INCOMPLETE", "Audit receipt protected-table snapshot map is missing or invalid.", 409);
  }
  const missingRequiredTables = REQUIRED_PROTECTED_AUDIT_TABLES.filter(
    (table) => !Object.hasOwn(candidateProtected, table),
  );
  if (
    missingRequiredTables.length > 0 ||
    inv.inventoryComplete !== true ||
    !Array.isArray(inv.missingRequiredTables) ||
    inv.missingRequiredTables.length > 0 ||
    inv.auditedTablesCount !== Object.keys(candidateProtected).length ||
    !Number.isInteger(inv.migrationCount) ||
    inv.migrationCount < 0
  ) {
    reject(
      "AUDIT_INVENTORY_INCOMPLETE",
      `Audit inventory is missing required protected tables (${missingRequiredTables.slice(0, 5).join(", ")}).`,
      409,
    );
  }
  if (computeProtectedSnapshotDigest(candidateProtected) !== receipt.snapshots.candidateDigest) {
    reject("PARITY_VERIFICATION_MISMATCH", "Candidate protected-row snapshot digest mismatch.", 409);
  }

  // Window & timestamp freshness checks
  const observedMs = Date.parse(String(receipt.observedAt ?? ""));
  const expiresMs = Date.parse(String(receipt.expiresAt ?? ""));
  const windowStartMs = Date.parse(String(receipt.window?.windowStart ?? ""));
  const windowEndMs = Date.parse(String(receipt.window?.windowEnd ?? ""));
  if (
    !Number.isFinite(observedMs) ||
    !Number.isFinite(expiresMs) ||
    expiresMs <= observedMs ||
    !Number.isFinite(windowStartMs) ||
    !Number.isFinite(windowEndMs) ||
    windowEndMs < windowStartMs
  ) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receipt window timestamps are invalid.", 400);
  }

  const nowMs = typeof expected.nowMs === "number" ? expected.nowMs : Date.now();
  if (expected.enforceFreshness !== false) {
    if (observedMs > nowMs || expiresMs <= nowMs) {
      reject("STALE_EVIDENCE", "Protected-row audit receipt is expired or observed in the future.", 409);
    }
  }

  // Provenance check (distinct auditor/reviewer if reviewer specified)
  const prov = receipt.provenance;
  if (
    !prov ||
    typeof prov.auditorPrincipal !== "string" ||
    !SAFE_ID_PATTERN.test(prov.auditorPrincipal) ||
    !["DEDICATED_READONLY_CLI", "AUTHORITY_VERIFIED_CAPTURE"].includes(prov.captureSource)
  ) {
    reject("AUDIT_RECEIPT_INVALID", "Audit receipt provenance is incomplete.", 400);
  }
  if (prov.reviewerPrincipal !== null && prov.reviewerPrincipal !== undefined) {
    if (typeof prov.reviewerPrincipal !== "string" || !SAFE_ID_PATTERN.test(prov.reviewerPrincipal) || prov.reviewerPrincipal === prov.auditorPrincipal) {
      reject("INDEPENDENT_REVIEW_REQUIRED", "Audit receipt reviewer must be distinct from the auditor.", 403);
    }
  }

  // Baseline & comparison checks (when parity/context eligibility required)
  if (expected.requireParityEligibility !== false) {
    const baselineProtected = receipt.snapshots?.baselineProtected;
    if (
      receipt.window?.captureMode !== "BEFORE_AND_AFTER_COMPARISON" ||
      typeof receipt.baselineReference !== "string" ||
      !SAFE_ID_PATTERN.test(receipt.baselineReference) ||
      typeof receipt.baselineAt !== "string" ||
      !Number.isFinite(Date.parse(receipt.baselineAt)) ||
      Date.parse(receipt.baselineAt) > observedMs ||
      !isValidTableSummaryMap(baselineProtected) ||
      receipt.snapshots?.baselineDigest !== computeProtectedSnapshotDigest(baselineProtected)
    ) {
      reject("AUDIT_BASELINE_MISSING", "Audit receipt lacks an authentic pre-deployment baseline snapshot.", 409);
    }

    const documentedChangesAuthorized = Boolean(
      receipt.comparison?.documentedChangeReference &&
        receipt.comparison?.documentedChangeReason &&
        prov.reviewerPrincipal &&
        prov.reviewerPrincipal !== prov.auditorPrincipal,
    );
    const recomputed = evaluateAuditComparison(baselineProtected, candidateProtected, {
      documentedOperationalChanges: receipt.comparison?.documentedOperationalChanges ?? [],
      documentedChangeReference: receipt.comparison?.documentedChangeReference,
      documentedChangeReason: receipt.comparison?.documentedChangeReason,
      documentedChangesAuthorized,
    });

    if (
      receipt.comparison?.baselinePresent !== true ||
      receipt.comparison?.unchanged !== recomputed.unchanged ||
      receipt.comparison?.eligibleForParity !== recomputed.eligibleForParity ||
      JSON.stringify([...receipt.comparison.changedTables].sort()) !== JSON.stringify(recomputed.changedTables) ||
      JSON.stringify([...receipt.comparison.addedTables].sort()) !== JSON.stringify(recomputed.addedTables) ||
      JSON.stringify([...receipt.comparison.removedTables].sort()) !== JSON.stringify(recomputed.removedTables)
    ) {
      reject("PARITY_VERIFICATION_MISMATCH", "Audit comparison summary does not match stored snapshot diff.", 409);
    }

    if (!recomputed.eligibleForParity) {
      reject(
        "AUDIT_PROTECTED_CHANGES_UNVERIFIED",
        `Protected tables changed without an authorized documented operational change window (${recomputed.unexpectedChangedTables.concat(recomputed.addedTables, recomputed.removedTables).join(", ")}).`,
        409,
      );
    }
  }

  // Caller expectation checks
  if (expected.releaseSha && receipt.releaseSha !== expected.releaseSha) {
    reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt release SHA does not match target release SHA.", 409);
  }
  if (expected.classification && dbId.classification !== expected.classification) {
    reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt database classification does not match required environment.", 409);
  }
  if (expected.database && dbId.database !== expected.database) {
    reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt database name does not match expected database identity.", 409);
  }
  if (expected.reference && receipt.receiptReference !== expected.reference && receipt.receiptDigest !== expected.reference) {
    reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt does not match requested reference or digest.", 409);
  }
  if (expected.deployments) {
    const dep = receipt.deployments;
    const exp = expected.deployments;
    if (
      !dep ||
      (exp.vercelDeploymentId && dep.vercelDeploymentId !== exp.vercelDeploymentId) ||
      (exp.webDeploymentId && dep.webDeploymentId !== exp.webDeploymentId) ||
      (exp.operationsDeploymentId && dep.operationsDeploymentId !== exp.operationsDeploymentId) ||
      (exp.queryDeploymentId && dep.queryDeploymentId !== exp.queryDeploymentId)
    ) {
      reject("PARITY_VERIFICATION_MISMATCH", "Audit receipt deployment IDs do not match requested parity deployments.", 409);
    }
  }

  return receipt;
}

export function hashAuditHost(hostOrPort) {
  return createHash("sha256").update(String(hostOrPort ?? "")).digest("hex").slice(0, 16);
}
