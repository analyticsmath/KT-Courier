import { reconcileExpiredDispatchOffers } from "@/lib/services/dispatch-assignment.service";

const limit = Number.parseInt(process.argv[2] ?? "100", 10);
reconcileExpiredDispatchOffers(Number.isInteger(limit) ? limit : 100)
  .then((result) => console.log(`Dispatch expiry reconciliation completed: ${result.expired}/${result.scanned}.`))
  .catch((error) => { console.error(error instanceof Error ? error.message : "Dispatch expiry reconciliation failed."); process.exitCode = 1; });
