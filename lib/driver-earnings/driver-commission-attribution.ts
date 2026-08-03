import { Prisma } from "@prisma/client";
import { DriverEarningError } from "./errors";

export type DriverCommissionAllocationEvidence = Readonly<{ id: string; publicReference: string; amount: Prisma.Decimal; storeAttributedAmount: Prisma.Decimal; driverAttributedAmount: Prisma.Decimal; status: string; accrualStatus: string }>;

export function assertDriverCommissionAttribution(charges: readonly Readonly<{ commissionAllocationId: string; commissionAllocationPublicReference: string; amount: string }>[] , allocations: readonly DriverCommissionAllocationEvidence[]): void {
  const byId = new Map(allocations.map((row) => [row.id, row]));
  for (const charge of charges) {
    const allocation = byId.get(charge.commissionAllocationId);
    if (!allocation || allocation.publicReference !== charge.commissionAllocationPublicReference || allocation.status !== "ACCRUED" || allocation.accrualStatus !== "ACCRUED") throw new DriverEarningError("DRIVER_EARNING_COMMISSION_INVALID", "Commission allocation evidence is missing, mismatched, or not accrued.");
    const amount = new Prisma.Decimal(charge.amount);
    if (allocation.storeAttributedAmount.add(allocation.driverAttributedAmount).add(amount).greaterThan(allocation.amount)) throw new DriverEarningError("DRIVER_EARNING_COMMISSION_OVER_ATTRIBUTED", "Store and driver attribution would exceed the commission allocation.");
  }
}
