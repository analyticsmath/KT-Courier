import { AccessBoundaryIllustration } from "./AccessBoundaryIllustration";
import { ParcelDeskIllustration } from "./ParcelDeskIllustration";
import { RouteQueueIllustration } from "./RouteQueueIllustration";
import { SecureLedgerIllustration } from "./SecureLedgerIllustration";

/** R13 has exactly four reusable, data-free illustration foundations. */
export const PROTECTED_ILLUSTRATIONS = {
  PARCEL_DESK: ParcelDeskIllustration,
  ROUTE_QUEUE: RouteQueueIllustration,
  ACCESS_BOUNDARY: AccessBoundaryIllustration,
  SECURE_LEDGER: SecureLedgerIllustration,
} as const;
