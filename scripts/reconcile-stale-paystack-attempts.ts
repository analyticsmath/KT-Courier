import { prisma } from "../lib/db/prisma";
import {
  parseStalePaystackReconciliationArgs,
  reconcileStalePaystackAttempts,
} from "../lib/services/paystack-verify-recovery.service";

// Safe Paystack stale-attempt recovery/reconciliation CLI.
// Defaults strictly to DRY_RUN; pass --apply only after verifying target records against Paystack.
async function main() {
  const options = parseStalePaystackReconciliationArgs(process.argv.slice(2));
  const staleBefore = new Date(Date.now() - options.staleMinutes * 60_000);

  const report = await reconcileStalePaystackAttempts({
    mode: options.mode,
    staleBefore,
    limit: options.limit,
    orderNumbers: options.orderNumbers,
    merchantReferences: options.merchantReferences,
    paymentPublicReferences: options.paymentPublicReferences,
    trigger: "cli_reconcile_stale_paystack_attempts",
  });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Stale Paystack reconciliation failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
