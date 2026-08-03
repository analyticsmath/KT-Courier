import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";

export const ledgerPrisma = new PrismaClient();

export function ledgerTag(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function platformAccounts() {
  const accounts = await ledgerPrisma.ledgerAccount.findMany({
    where: { code: { in: ["PLATFORM-CASH-CLEARING-ZAR", "PLATFORM-ADJUSTMENT-ZAR"] } },
  });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const cash = byCode.get("PLATFORM-CASH-CLEARING-ZAR");
  const adjustment = byCode.get("PLATFORM-ADJUSTMENT-ZAR");
  if (!cash || !adjustment) throw new Error("Seeded platform ledger accounts are missing.");
  return { cash, adjustment };
}

export async function createCustomerAsset(prefix: string) {
  const tag = ledgerTag(prefix);
  const user = await ledgerPrisma.user.create({
    data: { email: `${tag}@ledger.test`, name: tag, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, passwordHash: "integration-only" },
  });
  const wallet = await ensureWalletForOwner({ ownerType: "CUSTOMER", ownerId: user.id, currency: "ZAR" });
  const account = await ensureLedgerAccount({ walletId: wallet.id, code: `CUSTOMER-${tag.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`.slice(0, 79), purpose: "AVAILABLE", category: "ASSET", currency: "ZAR" });
  return { tag, user, wallet, account };
}

export async function fundAsset(accountId: string, amount = "10.00", prefix = "fund") {
  const { adjustment } = await platformAccounts();
  const tag = ledgerTag(prefix);
  return postLedgerJournal({
    idempotencyKey: `${tag}:command`,
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: `${tag}:source`,
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId, direction: "DEBIT", amount, lineCode: "CUSTOMER-ASSET" },
      { accountId: adjustment.id, direction: "CREDIT", amount, lineCode: "PLATFORM-CONTROL" },
    ],
  });
}

