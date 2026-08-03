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
