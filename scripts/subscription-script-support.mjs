import { spawn } from "node:child_process";

export function subscriptionScriptOptions(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  const limitIndex = argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be an integer from 1 to 500.");
  if (apply && argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --apply.");
  return { apply, dryRun, limit };
}

const CANONICAL_SERVICES = Object.freeze({
  "create-subscription-renewal-cycles": "createNextSubscriptionBillingCycle",
  "process-subscription-renewals": "prepareSubscriptionRenewalPayment",
  "process-subscription-dunning": "processSubscriptionDunning",
  "process-subscription-cancellations": "applySubscriptionCancellation",
  "synchronize-subscription-providers": "synchronizeSubscriptionProviderAuthority",
  "expire-subscription-entitlements": "expireSubscriptionEntitlements",
  "scan-subscription-reconciliation": "scanSubscriptionReconciliation",
  "recognize-subscription-revenue": "recognizeSubscriptionRevenue",
});

/** The .mjs layer never mutates records. Apply delegates to the canonical TypeScript service process. */
export async function runSubscriptionOperation(name, argv = process.argv.slice(2)) {
  const { apply, dryRun, limit } = subscriptionScriptOptions(argv);
  const canonicalService = CANONICAL_SERVICES[name];
  if (!canonicalService) throw new Error(`${name}: canonical subscription processor is not declared.`);
  if (dryRun) {
    console.log(`${name}: dry-run canonical ${canonicalService} (limit ${limit}); no records mutated.`);
    return Object.freeze({ mode: "dry-run", canonicalService, limit });
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["--no-install", "tsx", "scripts/subscription-processor.ts", name, "--apply", "--limit", String(limit)], { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(undefined) : reject(new Error(`${name}: canonical processor exited with ${code ?? "unknown"}.`)));
  });
  return Object.freeze({ mode: "apply", canonicalService, limit });
}
