import type {
  LedgerAccountCategoryCode,
  LedgerAccountPurposeCode,
  LedgerAccountStatusCode,
  LedgerCurrencyCode,
  LedgerEntryDirectionCode,
  LedgerJournalTypeCode,
  LedgerOwnerTypeCode,
  SafeLedgerMetadata,
} from "@/lib/ledger/types";

export type LedgerPaginationDto = Readonly<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export type SafeLedgerOwnerDto = Readonly<{
  type: LedgerOwnerTypeCode;
  id: string;
  label: string;
}>;

export type LedgerAccountSummaryDto = Readonly<{
  id: string;
  walletId: string;
  code: string;
  purpose: LedgerAccountPurposeCode;
  category: LedgerAccountCategoryCode;
  currency: LedgerCurrencyCode;
  status: LedgerAccountStatusCode;
  allowNegative: boolean;
  currentBalance: string;
  debitTotal: string;
  creditTotal: string;
  version: number;
  owner: SafeLedgerOwnerDto;
  createdAt: string;
  updatedAt: string;
}>;

export type LedgerEntryDto = Readonly<{
  id: string;
  sequence: number;
  direction: LedgerEntryDirectionCode;
  amount: string;
  lineCode: string;
  memo: string | null;
  createdAt: string;
  account: Readonly<{
    id: string;
    code: string;
    purpose: LedgerAccountPurposeCode;
    category: LedgerAccountCategoryCode;
  }>;
  journal: Readonly<{
    id: string;
    reference: string;
    type: LedgerJournalTypeCode;
    postedAt: string;
  }>;
}>;

export type LedgerJournalSummaryDto = Readonly<{
  id: string;
  reference: string;
  type: LedgerJournalTypeCode;
  currency: LedgerCurrencyCode;
  totalDebits: string;
  totalCredits: string;
  balanced: boolean;
  sourceReference: string | null;
  correlationId: string | null;
  postedAt: string;
  originalJournal: Readonly<{ id: string; reference: string }> | null;
  reversalJournal: Readonly<{ id: string; reference: string }> | null;
}>;

export type LedgerJournalDetailDto = LedgerJournalSummaryDto & Readonly<{
  memo: string | null;
  policyVersion: string;
  metadata: SafeLedgerMetadata | null;
  metadataRedacted: boolean;
  entries: readonly LedgerEntryDto[];
}>;

export type LedgerAccountListDto = Readonly<{
  data: readonly LedgerAccountSummaryDto[];
  pagination: LedgerPaginationDto;
}>;

export type LedgerJournalListDto = Readonly<{
  data: readonly LedgerJournalSummaryDto[];
  pagination: LedgerPaginationDto;
}>;

export type LedgerAccountDetailDto = Readonly<{
  account: LedgerAccountSummaryDto;
  entries: readonly LedgerEntryDto[];
  pagination: LedgerPaginationDto;
}>;

