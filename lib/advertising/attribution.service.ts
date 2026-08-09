/**
 * Marketplace checkout no longer retains a browser-session identifier. Until
 * consented, canonical attribution evidence is introduced, conversion
 * attribution must remain disabled rather than inferring identity from order,
 * customer, or guest-access records.
 */
export class AdvertisingAttributionService {
  constructor(tx?: Prisma.TransactionClient) {
    void tx;
  }

  async attributeOrder(marketplaceOrderId: string): Promise<void> {
    void marketplaceOrderId;
    // Intentionally no-op: current persistence has no trustworthy click link.
  }
}
import type { Prisma } from "@prisma/client";
