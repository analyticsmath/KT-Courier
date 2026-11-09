import { Prisma } from "@prisma/client";

export class AdminWalletGrantError extends Error {
  constructor(readonly code: "INVALID_GRANT" | "UNAUTHORIZED" | "CUSTOMER_NOT_FOUND", message: string) {
    super(message);
    this.name = "AdminWalletGrantError";
  }
}

export type ValidatedAdminWalletGrant = Readonly<{
  amount: string;
  reason: string;
  operationId: string;
}>;

/** Owner-funded bonus credit; never a claimed bank deposit, top-up or refund.
 * Grants are limited per operation so one mistaken request cannot mint an
 * unbounded customer liability. Any amount is independently journaled.
 */
export function validateAdminWalletGrant(input: unknown): ValidatedAdminWalletGrant {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AdminWalletGrantError("INVALID_GRANT", "A wallet credit request is required.");
  }
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(k => !["amount", "reason", "operationId"].includes(k))
    || typeof data.amount !== "string" || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(data.amount)) {
    throw new AdminWalletGrantError("INVALID_GRANT", "Enter a positive ZAR amount, with at most two decimal places.");
  }
  const money = new Prisma.Decimal(data.amount);
  if (!money.gt(0) || money.gt("5000.00")) {
    throw new AdminWalletGrantError("INVALID_GRANT", "One administrative grant must be between R0.01 and R5,000.00.");
  }
  if (typeof data.reason !== "string" || data.reason.trim().length < 12 || data.reason.trim().length > 220) {
    throw new AdminWalletGrantError("INVALID_GRANT", "A meaningful reason of 12–220 characters is required for the financial audit.");
  }
  if (typeof data.operationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,95}$/.test(data.operationId)) {
    throw new AdminWalletGrantError("INVALID_GRANT", "A stable operation identifier of 8–96 characters is required.");
  }
  return Object.freeze({ amount: money.toFixed(2), reason: data.reason.trim(), operationId: data.operationId });
}
