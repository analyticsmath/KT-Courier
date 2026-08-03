import { Decimal } from "@prisma/client/runtime/library";

export interface PublicCampaign {
  publicReference: string;
  name: string;
  status: string;
  description?: string;
}

export interface PublicCampaignVersion {
  versionNumber: number;
  discountType: string;
  discountValue: Decimal;
  maximumDiscountAmount?: Decimal;
}

export interface PublicCode {
  publicReference: string;
  codeMasked: string;
  status: string;
}

export interface PublicRedemption {
  publicReference: string;
  checkoutReference: string;
  totalDiscountAmount: Decimal;
}

export interface PublicBudget {
  version: number;
  availableAmount: Decimal;
  status: string;
}

export interface PublicReconciliationCase {
  publicReference: string;
  reason: string;
  status: string;
}
