import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { processAutomaticOrdinaryReferralAwards } from "@/lib/rewards/ordinary-referral-award.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

const userIds: string[] = [];
let codeId = "";
let firstId = "";
let secondId = "";
let originalIssuing = false;
let databaseValidated = false;
const oldFirst = new Date("2024-01-01T00:00:00.000Z");
const oldSecond = new Date("2024-01-02T00:00:00.000Z");

beforeAll(async () => {
  requireDisposableStoreSettlementDatabase();
  databaseValidated = true;
  const setting = await prisma.systemSetting.findUniqueOrThrow({ where: { key: "referral.reward_issuing_enabled" } });
  originalIssuing = setting.value === true;
  await prisma.systemSetting.update({ where: { key: setting.key }, data: { value: true } });
  const nonce = randomUUID();
  for (const role of ["owner", "first", "second"]) {
    const user = await prisma.user.create({ data: { email: `queue-${role}-${nonce}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
    userIds.push(user.id);
  }
  const code = await prisma.referralCode.create({ data: {
    code: `KTR-${nonce.replaceAll("-", "").toUpperCase()}`, ownerType: "CUSTOMER", ownerId: userIds[0],
    isActive: true, metadata: { program: "ORDINARY_REFERRAL_V1" },
  } });
  codeId = code.id;
  const first = await prisma.referralEvent.create({ data: { referralCodeId: codeId, targetType: "CUSTOMER", targetUserId: userIds[1], source: "ORDINARY_SIGNUP", status: "PENDING", createdAt: oldFirst, updatedAt: oldFirst } });
  const second = await prisma.referralEvent.create({ data: { referralCodeId: codeId, targetType: "CUSTOMER", targetUserId: userIds[2], source: "ORDINARY_SIGNUP", status: "PENDING", createdAt: oldSecond, updatedAt: oldSecond } });
  firstId = first.id; secondId = second.id;
});

afterAll(async () => {
  if (!databaseValidated) return;
  await prisma.systemSetting.update({ where: { key: "referral.reward_issuing_enabled" }, data: { value: originalIssuing } });
  await prisma.referralEvent.deleteMany({ where: { id: { in: [firstId, secondId] } } });
  if (codeId) await prisma.referralCode.delete({ where: { id: codeId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

it("does not mutate pending referrals while issuing is disabled", async () => {
  await prisma.systemSetting.update({ where: { key: "referral.reward_issuing_enabled" }, data: { value: false } });
  try {
    const result = await processAutomaticOrdinaryReferralAwards({ batchSize: 1, actorUserId: "disposable-operator" });
    expect(result).toMatchObject({ itemsExamined: 0, itemsAwarded: 0, itemsFailed: 0 });
    expect((await prisma.referralEvent.findUniqueOrThrow({ where: { id: firstId } })).updatedAt.getTime()).toBe(oldFirst.getTime());
  } finally {
    await prisma.systemSetting.update({ where: { key: "referral.reward_issuing_enabled" }, data: { value: true } });
  }
});

it("rotates unpaid referrals so later pending referrals are examined, without awarding either", async () => {
  const first = await processAutomaticOrdinaryReferralAwards({ batchSize: 1, actorUserId: "disposable-operator" });
  expect(first).toMatchObject({ itemsExamined: 1, itemsAwarded: 0, itemsSkipped: 1, itemsFailed: 0 });
  const afterFirst = await prisma.referralEvent.findMany({ where: { id: { in: [firstId, secondId] } } });
  expect(afterFirst.find(row => row.id === firstId)?.updatedAt.getTime()).toBeGreaterThan(oldFirst.getTime());
  expect(afterFirst.find(row => row.id === secondId)?.updatedAt.getTime()).toBe(oldSecond.getTime());

  const second = await processAutomaticOrdinaryReferralAwards({ batchSize: 1, actorUserId: "disposable-operator" });
  expect(second).toMatchObject({ itemsExamined: 1, itemsAwarded: 0, itemsSkipped: 1, itemsFailed: 0 });
  const afterSecond = await prisma.referralEvent.findMany({ where: { id: { in: [firstId, secondId] } } });
  expect(afterSecond.find(row => row.id === secondId)?.updatedAt.getTime()).toBeGreaterThan(oldSecond.getTime());
  expect(afterSecond.every(row => row.status === "PENDING" && row.rewardedAt === null)).toBe(true);
});
