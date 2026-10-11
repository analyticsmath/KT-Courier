import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAccountEmail } from "@/lib/services/account-email-verification.service";
const f = vi.hoisted(() => ({ identity: vi.fn(), user: vi.fn(), lock: vi.fn(), otp: vi.fn(), consume: vi.fn(), update: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({ $queryRaw: f.lock, user: { findUnique: f.identity, findUniqueOrThrow: f.user, update: f.update }, otpCode: { findFirst: f.otp, updateMany: f.consume }, session: { create: f.session } }) } }));
beforeEach(() => {
  vi.resetAllMocks(); f.identity.mockResolvedValue({ id: "account" }); f.lock.mockResolvedValue([{ id: "account" }]);
  f.user.mockResolvedValue({ id: "account", role: "CUSTOMER", status: "PENDING_VERIFICATION", emailVerifiedAt: null });
  f.otp.mockResolvedValue({ id: "otp", expiresAt: new Date(Date.now() + 60_000) }); f.consume.mockResolvedValue({ count: 1 });
});
describe("email verification eligibility and atomic session boundary (T1 doubles)", () => {
  it.each(["SUSPENDED", "DISABLED"])("never reactivates %s with an old code", async status => {
    f.user.mockResolvedValue({ id: "account", role: "CUSTOMER", status });
    expect(await verifyAccountEmail("owned@example.test", "123456")).toMatchObject({ ok: false, status: 403 });
    expect(f.otp).not.toHaveBeenCalled(); expect(f.consume).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled(); expect(f.session).not.toHaveBeenCalled();
  });
  it("does not consume a code when its account is missing", async () => {
    f.identity.mockResolvedValue(null); expect(await verifyAccountEmail("missing@example.test", "123456")).toMatchObject({ ok: false, status: 404 });
    expect(f.lock).not.toHaveBeenCalled(); expect(f.consume).not.toHaveBeenCalled(); expect(f.session).not.toHaveBeenCalled();
  });
  it("refuses a missing or consumed matching code", async () => {
    f.otp.mockResolvedValue(null); expect(await verifyAccountEmail("owned@example.test", "123456")).toMatchObject({ ok: false, status: 400 }); expect(f.session).not.toHaveBeenCalled();
  });
  it("refuses expired evidence without activation", async () => {
    f.otp.mockResolvedValue({ id: "otp", expiresAt: new Date(0) }); expect(await verifyAccountEmail("owned@example.test", "123456")).toMatchObject({ ok: false, status: 400 }); expect(f.consume).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled();
  });
  it("does not create a session when code consumption loses a race", async () => {
    f.consume.mockResolvedValue({ count: 0 }); expect(await verifyAccountEmail("owned@example.test", "123456")).toMatchObject({ ok: false, status: 400 }); expect(f.update).not.toHaveBeenCalled(); expect(f.session).not.toHaveBeenCalled();
  });
  it("issues a hashed session only after successful eligible code consumption", async () => {
    const result = await verifyAccountEmail("owned@example.test", "123456"); expect(result).toMatchObject({ ok: true, role: "CUSTOMER" });
    expect(f.session).toHaveBeenCalledOnce(); expect(f.session.mock.calls[0][0].data.tokenHash).not.toBe(result.ok ? result.rawToken : null);
    expect(f.lock.mock.invocationCallOrder[0]).toBeLessThan(f.user.mock.invocationCallOrder[0]);
    expect(f.consume.mock.invocationCallOrder[0]).toBeLessThan(f.update.mock.invocationCallOrder[0]); expect(f.update.mock.invocationCallOrder[0]).toBeLessThan(f.session.mock.invocationCallOrder[0]);
  });
});
