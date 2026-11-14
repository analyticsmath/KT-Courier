import { Decimal } from "@prisma/client/runtime/library";
import { FundingType } from "./promotion-policy";

export interface LineAllocationContext {
  lineId: string;
  basisAmount: Decimal;
}

export interface PromotionAllocationInput {
  totalDiscountAmount: Decimal;
  lines: LineAllocationContext[];
  fundingType: FundingType;
  platformShareBps?: number;
}

export interface LineAllocationEvidence {
  lineId: string;
  basisAmount: Decimal;
  discountAmount: Decimal;
  platformFunding: Decimal;
  storeFunding: Decimal;
}

/** Bind every evaluated line or delivery allocation to its authoritative store. */
export function attachPromotionStoreReferences(allocations: readonly LineAllocationEvidence[], groups: readonly { storeReference: string; lines: readonly { lineReference: string }[] }[]) {
  const stores = new Map<string, string>();
  for (const group of groups) {
    for (const reference of [...group.lines.map(line => line.lineReference), `${group.storeReference}_delivery`]) {
      if (stores.has(reference)) throw new Error("Promotion allocation source is ambiguous.");
      stores.set(reference, group.storeReference);
    }
  }
  return allocations.map(allocation => {
    const storeReference = stores.get(allocation.lineId);
    if (!storeReference) throw new Error("Promotion allocation has no checkout store source.");
    if (![allocation.discountAmount, allocation.platformFunding, allocation.storeFunding].every(amount => amount.isFinite() && !amount.isNegative()) || !allocation.platformFunding.plus(allocation.storeFunding).equals(allocation.discountAmount)) throw new Error("Promotion allocation funding does not reconcile.");
    return { ...allocation, storeReference };
  });
}

export function allocatePromotionDiscount(input: PromotionAllocationInput): LineAllocationEvidence[] {
  const totalBasis = input.lines.reduce((sum, line) => sum.plus(line.basisAmount), new Decimal(0));
  
  if (totalBasis.equals(0)) {
    return input.lines.map(line => ({
      lineId: line.lineId,
      basisAmount: line.basisAmount,
      discountAmount: new Decimal(0),
      platformFunding: new Decimal(0),
      storeFunding: new Decimal(0),
    }));
  }

  let remainingDiscount = input.totalDiscountAmount;
  const allocations: LineAllocationEvidence[] = [];

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    let lineDiscount = new Decimal(0);

    if (i === input.lines.length - 1) {
      // Last line gets remainder
      lineDiscount = remainingDiscount;
    } else {
      const proportion = line.basisAmount.dividedBy(totalBasis);
      lineDiscount = input.totalDiscountAmount.times(proportion).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      remainingDiscount = remainingDiscount.minus(lineDiscount);
    }

    if (lineDiscount.lessThan(0)) {
      lineDiscount = new Decimal(0);
    }

    let platformFunding = new Decimal(0);
    let storeFunding = new Decimal(0);

    if (input.fundingType === "PLATFORM") {
      platformFunding = lineDiscount;
    } else if (input.fundingType === "STORE") {
      storeFunding = lineDiscount;
    } else if (input.fundingType === "SHARED" && input.platformShareBps !== undefined) {
      platformFunding = lineDiscount.times(new Decimal(input.platformShareBps).dividedBy(10000)).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      storeFunding = lineDiscount.minus(platformFunding);
    }

    allocations.push({
      lineId: line.lineId,
      basisAmount: line.basisAmount,
      discountAmount: lineDiscount,
      platformFunding,
      storeFunding,
    });
  }

  return allocations;
}
