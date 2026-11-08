import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  bindOrdinaryReferralAtSignup, createOrdinaryReferralCode, getOrdinaryReferralCode,
} from "@/lib/rewards/ordinary-referral.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { inspectOrdinaryReferralEligibility } from "@/lib/rewards/ordinary-referral-eligibility.service";

describe("ordinary signup referral on a real isolated PostgreSQL database", () => {
  const ids: string[] = [];
  let ownerUserId = "", storeUserId = "", storeId = "", firstCustomerId = "", secondCustomerId = "";
  let customerCode = "", storeCode = "";
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const nonce = randomUUID();
    const owner = await prisma.user.create({
      data: { email: 'ordinary-owner-' + nonce + '@example.test', role: 'CUSTOMER', status: 'ACTIVE', phone: '0710000001' },
    });
    const storeOwner = await prisma.user.create({
      data: { email: 'ordinary-store-' + nonce + '@example.test', role: 'STORE', status: 'ACTIVE', phone: '0710000002' },
    });
    const first = await prisma.user.create({
      data: { email: 'ordinary-new-' + nonce + '@example.test', role: 'CUSTOMER', phone: '0720000001' },
    });
    const second = await prisma.user.create({
      data: { email: 'ordinary-second-' + nonce + '@example.test', role: 'CUSTOMER', phone: '0720000002' },
    });
    ids.push(owner.id, storeOwner.id, first.id, second.id);
    ownerUserId = owner.id;
    storeUserId = storeOwner.id;
    firstCustomerId = first.id;
    secondCustomerId = second.id;
    const store = await prisma.store.create({
      data: { ownerUserId: storeOwner.id, name: 'Disposable referral merchant', slug: 'ordinary-referral-' + nonce, status: 'ACTIVE' },
    });
    storeId = store.id;
  });
  afterAll(async () => {
    try {
      // All rows in this test are ordinary referral/test-only records.
      await prisma.referralEvent.deleteMany({
        where: { targetUserId: { in: ids }, source: 'ORDINARY_SIGNUP' },
      });
      await prisma.referralCode.deleteMany({
        where: { OR: [{ ownerType: 'CUSTOMER', ownerId: ownerUserId }, { ownerType: 'STORE', ownerId: storeId }] },
      });
      if (storeId) await prisma.store.delete({ where: { id: storeId } });
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("creates one customer and one store referral code, reusable under concurrent requests", async () => {
    const owner = { userId: ownerUserId, ownerType: 'CUSTOMER' as const };
    const codes = await Promise.all([createOrdinaryReferralCode(owner), createOrdinaryReferralCode(owner)]);
    expect(codes[0].code).toEqual(codes[1].code);
    customerCode = codes[0].code;
    expect(codes.filter(x => x.replayed === false)).toHaveLength(1);
    expect(await prisma.referralCode.count({
      where: { ownerType: 'CUSTOMER', ownerId: ownerUserId },
    })).toBe(1);
    await expect(prisma.referralCode.create({ data: {
      ownerType: 'CUSTOMER', ownerId: ownerUserId, code: 'KTR-' + 'A'.repeat(24),
      metadata: { program: 'ORDINARY_REFERRAL_V1' }, isActive: true,
    } })).rejects.toThrow();
    const storeOwner = { userId: storeUserId, ownerType: 'STORE' as const, storeId };
    const storeIssued = await createOrdinaryReferralCode(storeOwner);
    storeCode = storeIssued.code;
    expect(storeCode).not.toEqual(customerCode);
    await expect(createOrdinaryReferralCode({ userId: ownerUserId, ownerType: 'STORE', storeId }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("binds signup to one referrer without awarding any money, rejects duplicate and cross-program attribution", async () => {
    const first = await prisma.$transaction(tx => bindOrdinaryReferralAtSignup(tx, {
      targetUserId: firstCustomerId, targetType: 'CUSTOMER', code: customerCode,
    }));
    expect(first.status).toBe('PENDING');
    await expect(prisma.$transaction(tx => bindOrdinaryReferralAtSignup(tx, {
      targetUserId: firstCustomerId, targetType: 'CUSTOMER', code: storeCode,
    }))).rejects.toMatchObject({ code: 'ALREADY_ATTRIBUTED' });
    const store = await prisma.$transaction(tx => bindOrdinaryReferralAtSignup(tx, {
      targetUserId: secondCustomerId, targetType: 'CUSTOMER', code: storeCode,
    }));
    expect(store.status).toBe('PENDING');
    // The database prohibits a duplicate independent of the application check.
    await expect(prisma.referralEvent.create({ data: {
      targetUserId: firstCustomerId, targetType: 'CUSTOMER',
      referralCodeId: (await prisma.referralCode.findUniqueOrThrow({ where: { code: storeCode } })).id,
      status: 'PENDING', source: 'ORDINARY_SIGNUP',
    } })).rejects.toThrow();
    const projected = await getOrdinaryReferralCode({ ownerType: 'CUSTOMER', userId: ownerUserId });
    expect(projected).toMatchObject({ code: customerCode, referralsPending: 1, referralsRewarded: 0 });
    expect(await prisma.ledgerJournal.count({
      where: { sourceReference: { startsWith: 'ORDINARY_REFERRAL:' } },
    })).toBe(0);
  });

  it("does not treat signup or an unverified account as an earned paid referral", async () => {
    const pending = await prisma.referralEvent.findFirstOrThrow({
      where: { targetUserId: firstCustomerId, source: 'ORDINARY_SIGNUP' },
      select: { id: true },
    });
    expect(await inspectOrdinaryReferralEligibility(pending.id)).toMatchObject({
      eligible: false, reason: 'INELIGIBLE_REFERRAL', qualifyingPaymentId: null,
    });
    await prisma.user.update({
      where: { id: firstCustomerId }, data: { status: 'ACTIVE' },
    });
    expect(await inspectOrdinaryReferralEligibility(pending.id)).toMatchObject({
      eligible: false, reason: 'NO_SUCCESSFUL_PAYMENT', qualifyingPaymentId: null,
    });
  });
});
