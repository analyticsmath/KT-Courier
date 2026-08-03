import { RefundError } from "./errors";

export function assertCustomerWalletAccount(input: Readonly<{
  ownerType: string;
  ownerId: string;
  expectedCustomerUserId: string;
  walletStatus: string;
  accountPurpose: string;
  accountCategory: string;
  accountCurrency: string;
  accountStatus: string;
  allowNegative: boolean;
}>): void {
  if (
    input.ownerType !== "CUSTOMER"
    || input.ownerId !== input.expectedCustomerUserId
    || input.walletStatus !== "ACTIVE"
    || input.accountPurpose !== "CUSTOMER_WALLET_AVAILABLE"
    || input.accountCategory !== "LIABILITY"
    || input.accountCurrency !== "ZAR"
    || input.accountStatus !== "ACTIVE"
    || input.allowNegative
  ) {
    throw new RefundError("REFUND_LEDGER_INCOHERENT", "Customer wallet account is not canonical.");
  }
}

