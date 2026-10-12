import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import { canonicalPaymentHash } from "@/lib/payments/hash";
import { MarketplaceCheckoutError } from "./errors";

type Command = Readonly<{ checkoutId: string; operationId: string; requestHash: string; expectedVersion: number; type: "RESERVE" | "PREPARE_PAYMENT" }>;

/** Bind the caller's hash AND canonical command before inventory/provider work.
 * Only database claims are retried. The callback may cross a provider boundary
 * and must never run inside a serializable retry loop.
 */
export async function runCheckoutCommand<T extends Prisma.InputJsonObject>(command: Command, work: (boundHash: string) => Promise<T>): Promise<T> {
  const boundHash = canonicalPaymentHash(command);
  const replay = await withSerializableRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${command.checkoutId} FOR UPDATE`;
    const prior = await tx.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId: command.checkoutId, operationId: command.operationId } } });
    if (prior) {
      if (prior.type !== command.type || prior.requestHash !== boundHash) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Operation ID is bound to different checkout evidence.");
      return prior.response as T | null;
    }
    const checkout = await tx.marketplaceCheckout.findUniqueOrThrow({ where: { id: command.checkoutId } });
    if (checkout.version !== command.expectedVersion) throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
    await tx.marketplaceCheckoutOperation.create({ data: { checkoutId: command.checkoutId, operationId: command.operationId, requestHash: boundHash, type: command.type } });
    return null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  if (replay) return replay;
  const result = await work(boundHash);
  // A crash before this write is recoverable using the canonical service's
  // inventory/payment idempotency. A receipt is immutable once populated.
  await prisma.marketplaceCheckoutOperation.updateMany({ where: { checkoutId: command.checkoutId, operationId: command.operationId, requestHash: boundHash, response: { equals: Prisma.DbNull } }, data: { response: result } });
  const saved = await prisma.marketplaceCheckoutOperation.findUniqueOrThrow({ where: { checkoutId_operationId: { checkoutId: command.checkoutId, operationId: command.operationId } } });
  return saved.response as T;
}
