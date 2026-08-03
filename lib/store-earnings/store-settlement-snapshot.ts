import { Prisma } from "@prisma/client";
import { StoreEarningError } from "./errors";
import { formatStoreEarningMoney, parseStoreEarningMoney } from "./store-earning-money";
import { assertStoreEarningSubject } from "./store-earning-subject";

export type StoreCommissionChargeSnapshot = Readonly<{
  commissionAllocationId: string;
  commissionAllocationPublicReference: string;
  amount: string;
  currency: "ZAR";
}>;

export type StoreSettlementSnapshot = Readonly<{
  subjectType: "MARKETPLACE_ORDER";
  subjectId: string;
  subjectPublicReference: string;
  storeId: string;
  storePublicReference: string;
  walletId: string;
  paymentId: string;
  paymentPublicReference: string;
  settlementReference: string;
  settlementVersion: string;
  calculationVersion: string;
  authoritativeAt: string;
  sellerSettlementBasisAmount: string;
  attributedCommissionAmount: string;
  netStoreEarningAmount: string;
  currency: "ZAR";
  commissionCharges: readonly StoreCommissionChargeSnapshot[];
}>;

function assertReference(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", `${label} is missing or exceeds the supported length.`);
  }
  return normalized;
}

export function validateStoreSettlementSnapshot(input: StoreSettlementSnapshot): StoreSettlementSnapshot {
  assertStoreEarningSubject(input);
  if (input.currency !== "ZAR") {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Store settlements support ZAR only.");
  }
  const authoritativeAt = new Date(input.authoritativeAt);
  if (authoritativeAt.toString() === "Invalid Date" || authoritativeAt.toISOString() !== input.authoritativeAt) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "The authoritative settlement time must be a canonical ISO timestamp.");
  }

  const basis = parseStoreEarningMoney(input.sellerSettlementBasisAmount);
  const attributed = parseStoreEarningMoney(input.attributedCommissionAmount, { allowZero: true });
  const earning = parseStoreEarningMoney(input.netStoreEarningAmount);
  if (!basis.sub(attributed).equals(earning)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Seller settlement basis minus attributed commission must equal the net store earning.");
  }

  const allocationIds = new Set<string>();
  const charges = input.commissionCharges.map((charge) => {
    if (charge.currency !== "ZAR") throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Commission charge currency must be ZAR.");
    const allocationId = assertReference(charge.commissionAllocationId, "Commission allocation ID");
    if (allocationIds.has(allocationId)) throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "A commission allocation may appear only once in a store settlement.");
    allocationIds.add(allocationId);
    return Object.freeze({
      commissionAllocationId: allocationId,
      commissionAllocationPublicReference: assertReference(charge.commissionAllocationPublicReference, "Commission allocation reference"),
      amount: formatStoreEarningMoney(parseStoreEarningMoney(charge.amount)),
      currency: "ZAR" as const,
    });
  });
  const chargeTotal = charges.reduce((total, charge) => total.add(charge.amount), new Prisma.Decimal(0));
  if (!chargeTotal.equals(attributed)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "Commission charge evidence must equal the attributed commission amount.");
  }

  return Object.freeze({
    subjectType: "MARKETPLACE_ORDER",
    subjectId: assertReference(input.subjectId, "Subject ID"),
    subjectPublicReference: assertReference(input.subjectPublicReference, "Subject reference"),
    storeId: assertReference(input.storeId, "Store ID"),
    storePublicReference: assertReference(input.storePublicReference, "Store reference"),
    walletId: assertReference(input.walletId, "Wallet ID"),
    paymentId: assertReference(input.paymentId, "Payment ID"),
    paymentPublicReference: assertReference(input.paymentPublicReference, "Payment reference"),
    settlementReference: assertReference(input.settlementReference, "Settlement reference"),
    settlementVersion: assertReference(input.settlementVersion, "Settlement version"),
    calculationVersion: assertReference(input.calculationVersion, "Calculation version"),
    authoritativeAt: authoritativeAt.toISOString(),
    sellerSettlementBasisAmount: formatStoreEarningMoney(basis),
    attributedCommissionAmount: formatStoreEarningMoney(attributed),
    netStoreEarningAmount: formatStoreEarningMoney(earning),
    currency: "ZAR",
    commissionCharges: Object.freeze(charges),
  });
}
