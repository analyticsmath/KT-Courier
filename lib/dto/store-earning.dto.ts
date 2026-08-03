export type StoreEarningHistoryDto = Readonly<{
  status: string;
  reasonCode: string | null;
  createdAt: string;
}>;

export type StoreEarningListItemDto = Readonly<{
  publicReference: string;
  subjectPublicReference: string;
  settlementReference: string;
  originalEarningAmount: string;
  refundReservedAmount: string;
  refundedAmount: string;
  releasedAmount: string;
  availablePayableAmount: string;
  currency: "ZAR";
  status: string;
  releaseEligibleAt: string | null;
  createdAt: string;
}>;

export type StoreEarningDetailDto = StoreEarningListItemDto & Readonly<{
  releaseJournalReference: string | null;
  history: readonly StoreEarningHistoryDto[];
  productionLock: Readonly<{ active: true; blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }>;
}>;

export type FinanceStoreEarningListItemDto = StoreEarningListItemDto & Readonly<{
  id: string;
  storePublicReference: string;
  paymentPublicReference: string;
  settlementVersion: string;
  settlementBasisAmount: string;
  attributedCommissionAmount: string;
  reversedAmount: string;
  reconciliationRequired: boolean;
}>;
