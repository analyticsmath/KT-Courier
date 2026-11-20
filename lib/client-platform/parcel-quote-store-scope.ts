import { PlatformError } from "./contracts";

/** A legacy unscoped quote remains subject to the existing ownership and pickup checks. */
export function assertQuoteStoreScope(quoteStoreId: string | null, selectedStoreId: string | null) {
  if (quoteStoreId && quoteStoreId !== selectedStoreId) {
    throw new PlatformError("QUOTE_WORKSPACE_MISMATCH", "This quote belongs to a different business workspace. Request a new quote.", 409);
  }
}
