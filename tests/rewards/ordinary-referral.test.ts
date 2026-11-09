import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeOrdinaryReferralCode, bindOrdinaryReferralAtSignup, createOrdinaryReferralCode } from "@/lib/rewards/ordinary-referral.service";
import { CustomerSignupSchema, StoreSignupSchema, DriverSignupSchema } from "@/lib/validation/auth";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(), userFindUnique: vi.fn(),
  storeFindFirst: vi.fn(),
  codeFindFirst: vi.fn(), codeFindUnique: vi.fn(), codeCreate: vi.fn(),
  eventFindFirst: vi.fn(), eventCreate: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      user: { findFirst: mocks.userFindFirst, findUnique: mocks.userFindUnique },
      store: { findFirst: mocks.storeFindFirst },
      referralCode: { findFirst: mocks.codeFindFirst, findUnique: mocks.codeFindUnique, create: mocks.codeCreate },
      referralEvent: { findFirst: mocks.eventFindFirst, create: mocks.eventCreate },
      $queryRawUnsafe: mocks.lock,
    }),
  },
}));
vi.mock("@/lib/ledger/retry", () => ({ withLedgerRetry: (work: () => unknown) => work() }));
const code = "KTR-1234567890ABCDEF12345678";
const tx = {
  user: { findFirst: mocks.userFindFirst, findUnique: mocks.userFindUnique },
  store: { findFirst: mocks.storeFindFirst },
  referralCode: { findFirst: mocks.codeFindFirst, findUnique: mocks.codeFindUnique, create: mocks.codeCreate },
  referralEvent: { findFirst: mocks.eventFindFirst, create: mocks.eventCreate },
};

describe("ordinary referral signup authority and anti-abuse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.userFindFirst.mockResolvedValue({ id: "owner-user", email: "owner@example.test", phone: "0711111111" });
    mocks.userFindUnique.mockResolvedValue({ id: "new-user", role: "CUSTOMER", email: "new@example.test", phone: "0722222222" });
    mocks.codeFindUnique.mockResolvedValue({
      id: "referral-code-id", isActive: true, ownerType: "CUSTOMER", ownerId: "owner-user",
      metadata: { program: "ORDINARY_REFERRAL_V1" },
    });
    mocks.eventFindFirst.mockResolvedValue(null);
    mocks.eventCreate.mockResolvedValue({ id: "referral-event-id", status: "PENDING" });
    mocks.lock.mockResolvedValue([]);
    mocks.codeFindFirst.mockResolvedValue(null);
    mocks.codeCreate.mockImplementation(async ({ data }) => ({ code: data.code }));
  });

  it("normalizes valid codes and rejects unsupported/referrer programme identifiers", () => {
    expect(normalizeOrdinaryReferralCode(" ktr-1234567890abcdef12345678 ")).toBe(code);
    for (const invalid of ["KTR-", "PROMOTER-CODE", "KTR-" + "Z".repeat(24), "x".repeat(100)]) {
      expect(() => normalizeOrdinaryReferralCode(invalid)).toThrow();
    }
  });

  it("adds optional referral code to customer and store signup but does not add it to driver signup", () => {
    const shared = { email: "new@example.test", password: "password123", confirmPassword: "password123", referralCode: code };
    expect(CustomerSignupSchema.parse({ ...shared, accountType: "CUSTOMER", fullName: "New Person" }).referralCode).toBe(code);
    expect(StoreSignupSchema.parse({ ...shared, accountType: "STORE", storeName: "My shop", contactPerson: "New Person", phone: "0722222222" }).referralCode).toBe(code);
    expect(DriverSignupSchema.parse({ ...shared, accountType: "DRIVER", fullName: "New Person", phone: "0722222222" })).not.toHaveProperty("referralCode");
  });

  it("binds exactly one pending signup event without any payment or ledger mutation", async () => {
    const result = await bindOrdinaryReferralAtSignup(tx as never, {
      code, targetUserId: "new-user", targetType: "CUSTOMER",
    });
    expect(result).toMatchObject({ status: "PENDING" });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: {
        referralCodeId: "referral-code-id", targetUserId: "new-user", targetType: "CUSTOMER",
        status: "PENDING", source: "ORDINARY_SIGNUP", metadata: { program: "ORDINARY_REFERRAL_V1" },
      },
      select: { id: true, status: true },
    });
  });

  it("denies unknown/inactive/promoter referral codes before creating attribution", async () => {
    for (const row of [null,
      { id: "x", isActive: false, ownerType: "CUSTOMER", ownerId: "owner-user", metadata: { program: "ORDINARY_REFERRAL_V1" } },
      { id: "x", isActive: true, ownerType: "PROMOTER", ownerId: "owner-user", metadata: { program: "ORDINARY_REFERRAL_V1" } },
      { id: "x", isActive: true, ownerType: "CUSTOMER", ownerId: "owner-user", metadata: { program: "PROMOTER" } },
    ]) {
      mocks.codeFindUnique.mockResolvedValueOnce(row);
      await expect(bindOrdinaryReferralAtSignup(tx as never, { code, targetUserId: "new-user", targetType: "CUSTOMER" }))
        .rejects.toMatchObject({ code: "INVALID_CODE" });
    }
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects attribution from the same account or registered phone", async () => {
    mocks.userFindUnique.mockResolvedValueOnce({ id: "owner-user", role: "CUSTOMER", email: "other@example.test" });
    await expect(bindOrdinaryReferralAtSignup(tx as never, { code, targetUserId: "owner-user", targetType: "CUSTOMER" }))
      .rejects.toMatchObject({ code: "SELF_REFERRAL" });
    mocks.userFindUnique.mockResolvedValueOnce({ id: "new-user", role: "CUSTOMER", email: "new@example.test", phone: "0711111111" });
    await expect(bindOrdinaryReferralAtSignup(tx as never, { code, targetUserId: "new-user", targetType: "CUSTOMER" }))
      .rejects.toMatchObject({ code: "SELF_REFERRAL" });
    mocks.userFindUnique.mockResolvedValueOnce({ id: "new-user", role: "CUSTOMER", email: "new@example.test", phone: "+27 71 111 1111" });
    await expect(bindOrdinaryReferralAtSignup(tx as never, { code, targetUserId: "new-user", targetType: "CUSTOMER" }))
      .rejects.toMatchObject({ code: "SELF_REFERRAL" });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("prevents a second attribution for a registered person", async () => {
    mocks.eventFindFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(bindOrdinaryReferralAtSignup(tx as never, { code, targetUserId: "new-user", targetType: "CUSTOMER" }))
      .rejects.toMatchObject({ code: "ALREADY_ATTRIBUTED" });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("issues only one idempotent code per authenticated customer and refuses an unowned store", async () => {
    const owner = { ownerType: "CUSTOMER" as const, userId: "owner-user" };
    const issued = await createOrdinaryReferralCode(owner);
    expect(issued.code).toMatch(/^KTR-[A-F0-9]{24}$/);
    expect(issued.replayed).toBe(false);
    mocks.codeFindFirst.mockResolvedValueOnce({ code: issued.code });
    expect(await createOrdinaryReferralCode(owner)).toEqual({ code: issued.code, replayed: true });
    expect(mocks.codeCreate).toHaveBeenCalledTimes(1);
    mocks.storeFindFirst.mockResolvedValueOnce(null);
    await expect(createOrdinaryReferralCode({ ownerType: "STORE", userId: "owner-user", storeId: "someone-elses-store" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
