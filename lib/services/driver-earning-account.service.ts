import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DriverEarningError } from "@/lib/driver-earnings/errors";
import { ensureLedgerAccount, ensureWalletForOwner } from "./wallet-account.service";

const code = (driverId: string, suffix: string) => `DRIVER-${createHash("sha256").update(driverId).digest("hex").slice(0, 20).toUpperCase()}-${suffix}`;

async function activeDriver(driverId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, include: { user: { select: { role: true, status: true } } } });
  if (!driver || !driver.active || driver.status !== "ACTIVE" || driver.onboardingStatus !== "APPROVED" || driver.user.role !== "DRIVER" || driver.user.status !== "ACTIVE") throw new DriverEarningError("DRIVER_EARNING_ACCOUNT_INVALID", "A canonical active and approved driver is required.");
  return driver;
}

export async function ensureDriverEarningPayableAccount(driverId: string) {
  const driver = await activeDriver(driverId);
  const wallet = await ensureWalletForOwner({ ownerType: "DRIVER", ownerId: driver.id, currency: "ZAR" });
  const [account, ownerWithdrawable] = await Promise.all([
    ensureLedgerAccount({ walletId: wallet.id, code: code(driver.id, "EARNINGS-PAYABLE-ZAR"), purpose: "DRIVER_EARNINGS_PAYABLE", category: "LIABILITY", currency: "ZAR" }),
    ensureLedgerAccount({ walletId: wallet.id, code: code(driver.id, "OWNER-WITHDRAWABLE-ZAR"), purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", currency: "ZAR" }),
  ]);
  if (account.currentBalance !== "0.00" && account.debitTotal === "0.00" && account.creditTotal === "0.00") throw new DriverEarningError("DRIVER_EARNING_ACCOUNT_INVALID", "Driver payable account did not open at zero.");
  return Object.freeze({ driver: Object.freeze({ id: driver.id, publicReference: driver.driverCode, userId: driver.userId }), wallet, account, ownerWithdrawable });
}

export async function resolveDriverEarningAccountsWithinTransaction(tx: Prisma.TransactionClient, input: Readonly<{ driverId: string; walletId: string; payableAccountId: string }>) {
  const driver = await tx.driverProfile.findUnique({ where: { id: input.driverId }, include: { user: { select: { role: true, status: true } } } });
  const wallet = await tx.wallet.findUnique({ where: { id: input.walletId } });
  const payable = await tx.ledgerAccount.findUnique({ where: { id: input.payableAccountId } });
  const ownerWithdrawable = await tx.ledgerAccount.findFirst({ where: { walletId: input.walletId, purpose: "OWNER_WITHDRAWABLE", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false } });
  if (!driver || !driver.active || driver.status !== "ACTIVE" || driver.onboardingStatus !== "APPROVED" || driver.user.role !== "DRIVER" || driver.user.status !== "ACTIVE" || !wallet || wallet.ownerType !== "DRIVER" || wallet.ownerId !== driver.id || wallet.currency !== "ZAR" || wallet.status !== "ACTIVE" || !payable || payable.walletId !== wallet.id || payable.purpose !== "DRIVER_EARNINGS_PAYABLE" || payable.category !== "LIABILITY" || payable.currency !== "ZAR" || payable.status !== "ACTIVE" || payable.allowNegative || !ownerWithdrawable) throw new DriverEarningError("DRIVER_EARNING_ACCOUNT_INVALID", "Canonical driver earning account evidence is invalid.");
  return { driver, wallet, payable, ownerWithdrawable };
}
