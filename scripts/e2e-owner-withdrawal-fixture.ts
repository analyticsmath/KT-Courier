import { prisma } from "@/lib/db/prisma";
import { accrueStoreEarning } from "@/lib/services/store-earning-accrual.service";
import { releaseStoreEarning } from "@/lib/services/store-earning-release.service";
import { registerPayoutDestination, transitionPayoutDestination } from "@/lib/services/payout-destination.service";
import { createDisposableStoreSettlement } from "./e2e-store-settlement-fixture";
import { requireDisposableStoreSettlementDatabase } from "./disposable-store-settlement-guard";
import { createDisposableDriverSettlement } from "./e2e-driver-settlement-fixture";
import { accrueDriverEarning } from "@/lib/services/driver-earning-accrual.service";
import { releaseDriverEarning } from "@/lib/services/driver-earning-release.service";
import { ensureWithdrawalAccounts } from "@/lib/services/withdrawal-account.service";

async function configureSyntheticDestination(tag: string, ownerType: "STORE" | "DRIVER", ownerId: string) {
  await prisma.withdrawalPolicy.upsert({ where: { ownerType_currency: { ownerType, currency: "ZAR" } }, create: { ownerType, currency: "ZAR", enabled: true, minimumAmount: "1.00", maximumAmount: "25.40", dailyMaximumAmount: "100.00", requiresReview: true, requiresDualControl: true, version: 1 }, update: { enabled: true, minimumAmount: "1.00", maximumAmount: "25.40", dailyMaximumAmount: "100.00", requiresReview: true, requiresDualControl: true } });
  const actor = await prisma.user.create({ data: { email: `${tag}-destination-finance@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
  const opaqueTag = tag.replace(/[0-9]/g, digit => "ghijklmnop"[Number(digit)]);
  const destination = await registerPayoutDestination({ actorUserId: actor.id, ownerType, ownerId, externalReference: `manual-finance:fixture-${opaqueTag}`, maskedLabel: "Disposable destination ****1234", institutionName: "Synthetic fixture", accountLast4: "1234" });
  await transitionPayoutDestination({ actorUserId: actor.id, publicReference: destination.publicReference, action: "ACTIVATE" });
  return { destination, actor };
}

/** Synthetic policy/destination facts; actual released earnings fund reserves and cancellations. */
export async function createDisposableOwnerWithdrawalSource(options: { storeId?: string } = {}) {
  requireDisposableStoreSettlementDatabase();
  const source = await createDisposableStoreSettlement({ storeId: options.storeId, amount: "25.40" });
  const earning = await accrueStoreEarning({ operationId: source.tag, snapshot: source.snapshot }, { allowTestOnlyBypass: true });
  await prisma.storeEarning.update({ where: { id: earning.id }, data: { releaseEligibleAt: new Date("2026-10-02T12:00:00Z") } });
  await releaseStoreEarning({ earningId: earning.id, operationId: `${source.tag}:release` }, { allowTestOnlyBypass: true });
  return { ...source, earning, ...await configureSyntheticDestination(source.tag, "STORE", source.store.id) };
}

export async function createDisposableDriverWithdrawalSource(options: { email?: string; passwordHash?: string } = {}) {
  requireDisposableStoreSettlementDatabase();
  const source = await createDisposableDriverSettlement({ ...options, amount: "25.40" });
  await ensureWithdrawalAccounts({ walletId: source.accounts.wallet.id, ownerType: "DRIVER" });
  const earning = await accrueDriverEarning({ operationId: source.tag, snapshot: source.snapshot }, { allowTestOnlyBypass: true });
  await releaseDriverEarning({ earningId: earning.id, operationId: `${source.tag}:release` }, { allowTestOnlyBypass: true });
  return { ...source, earning, ...await configureSyntheticDestination(source.tag, "DRIVER", source.driver.id) };
}
