export type WithdrawalStatusDto = "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED" | "RECONCILIATION_REQUIRED";

export type OwnerWithdrawalListItemDto = Readonly<{
  publicReference: string;
  amount: string;
  currency: "ZAR";
  status: WithdrawalStatusDto;
  destination: Readonly<{ publicReference: string; maskedLabel: string; institutionName: string | null; accountLast4: string | null }>;
  requestedAt: string;
  canCancel: boolean;
}>;

export type OwnerWithdrawalDetailDto = OwnerWithdrawalListItemDto & Readonly<{
  payoutAttempt: Readonly<{ publicReference: string; status: string }> | null;
  history: readonly Readonly<{ fromStatus: string | null; toStatus: string; reasonCode: string | null; createdAt: string }>[];
}>;

export type FinanceWithdrawalListItemDto = Readonly<{
  id: string;
  publicReference: string;
  ownerType: string;
  amount: string;
  currency: "ZAR";
  status: WithdrawalStatusDto;
  destination: Readonly<{ publicReference: string; maskedLabel: string; status: string }>;
  requestedAt: string;
  reconciliationRequired: boolean;
}>;

export type FinanceWithdrawalDetailDto = FinanceWithdrawalListItemDto & Readonly<{
  journals: Readonly<{ reserve: string; release: string | null; payout: string | null }>;
  payoutAttempts: readonly Readonly<{ publicReference: string; attemptNumber: number; status: string; externalReference: string | null; failureCode: string | null; createdAt: string }>[],
  approval: Readonly<{ approvedAt: string | null; approvedByUserId: string | null; completedAt: string | null; completedByUserId: string | null }>;
  history: readonly Readonly<{ fromStatus: string | null; toStatus: string; actorType: string; reasonCode: string | null; createdAt: string }>[],
  reconciliation: readonly Readonly<{ publicReference: string; reason: string; status: string; priority: string }>[],
}>;
