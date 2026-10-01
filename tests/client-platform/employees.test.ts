import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  store: { findMany: vi.fn(), count: vi.fn() },
  storeEmployeeMembership: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { storeAccess, ownedBusiness } from "@/lib/client-platform/store-access";
import {
  acceptEmployeeInvitation,
  inviteEmployee,
  updateEmployee,
  EmployeeInviteSchema,
} from "@/lib/client-platform/employees.service";
import {
  membershipAllows,
  moduleForStorePath,
} from "@/lib/client-platform/store-permissions";
import { createHash } from "node:crypto";
const store = { id: "store-1", ownerUserId: "owner", status: "ACTIVE" };
beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({
    role: "CUSTOMER",
    status: "ACTIVE",
    email: "worker@example.com",
    emailVerifiedAt: new Date(),
  });
  db.store.findMany.mockResolvedValue([]);
  db.store.count.mockResolvedValue(0);
  db.storeEmployeeMembership.findMany.mockResolvedValue([
    { store, permissions: ["orders", "products"], status: "ACTIVE" },
  ]);
  db.storeEmployeeMembership.count.mockResolvedValue(0);
  db.adminActivityLog.create.mockResolvedValue({});
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  db.$executeRaw.mockResolvedValue(1);
});
describe("employee authorization", () => {
  it("resolves the invited business and actual employee identity without owner impersonation", async () => {
    const a = await storeAccess("worker", "orders");
    expect(a.store.id).toBe("store-1");
    expect(a.owner).toBe(false);
    expect(db.storeEmployeeMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "worker",
          status: "ACTIVE",
          store: { status: "ACTIVE" },
        },
      }),
    );
  });
  it("rejects finance access despite other module grants", async () => {
    await expect(storeAccess("worker", "finance")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("reserves employee administration for the owner", async () => {
    await expect(ownedBusiness("worker")).rejects.toMatchObject({
      code: "STORE_OWNER_REQUIRED",
    });
  });
  it.each(["DISABLED", "REMOVED"])(
    "rejects a %s membership when no active membership is returned",
    async () => {
      db.storeEmployeeMembership.findMany.mockResolvedValue([]);
      await expect(storeAccess("worker", "orders")).rejects.toMatchObject({
        status: 403,
      });
    },
  );
  it("rejects ambiguous business memberships", async () => {
    db.storeEmployeeMembership.findMany.mockResolvedValue([
      { store, permissions: ["orders"] },
      { store: { ...store, id: "other" }, permissions: ["orders"] },
    ]);
    await expect(storeAccess("worker", "orders")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("rejects inactive user accounts even when membership is active", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "CUSTOMER",
      status: "SUSPENDED",
    });
    await expect(storeAccess("worker", "orders")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("treats unknown routes and employee management as owner-only", () => {
    expect(moduleForStorePath("/api/store/employees")).toBeNull();
    expect(moduleForStorePath("/store/unknown")).toBeNull();
    expect(membershipAllows(["*"], null)).toBe(false);
    expect(moduleForStorePath("/api/store/catalog/products/123")).toBe(
      "products",
    );
  });
});
describe("email-bound invitation lifecycle", () => {
  const token = "a".repeat(64);
  const invite = {
    id: "invite-1",
    storeId: store.id,
    store,
    email: "worker@example.com",
    status: "INVITED",
    inviteExpiresAt: new Date(Date.now() + 86400000),
  };
  it("stores only a token hash and returns a seven-day invitation", async () => {
    db.store.findMany.mockResolvedValue([store]);
    db.storeEmployeeMembership.findUnique.mockResolvedValue(null);
    db.storeEmployeeMembership.upsert.mockResolvedValue({ id: "membership" });
    const out = await inviteEmployee("owner", {
      email: "worker@example.com",
      roleLabel: "Operations",
      permissions: ["orders"],
    });
    const raw = out.invitationPath.split("token=")[1];
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    const args = db.storeEmployeeMembership.upsert.mock.calls[0][0];
    expect(args.create.inviteTokenHash).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
    expect(args.create.inviteTokenHash).not.toBe(raw);
    expect(out.expiresInDays).toBe(7);
  });
  it("rejects a token intended for another email", async () => {
    db.storeEmployeeMembership.findUnique.mockResolvedValue({
      ...invite,
      email: "someoneelse@example.com",
    });
    await expect(
      acceptEmployeeInvitation("worker", token),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
    expect(db.storeEmployeeMembership.updateMany).not.toHaveBeenCalled();
  });
  it("rejects expired invitations", async () => {
    db.storeEmployeeMembership.findUnique.mockResolvedValue({
      ...invite,
      inviteExpiresAt: new Date(0),
    });
    await expect(
      acceptEmployeeInvitation("worker", token),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });
  it("requires verified email", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "CUSTOMER",
      status: "ACTIVE",
      email: "worker@example.com",
      emailVerifiedAt: null,
    });
    await expect(
      acceptEmployeeInvitation("worker", token),
    ).rejects.toMatchObject({ code: "VERIFIED_ACCOUNT_REQUIRED" });
  });
  it("prevents joining a second active business", async () => {
    db.storeEmployeeMembership.findUnique.mockResolvedValue(invite);
    db.storeEmployeeMembership.count.mockResolvedValue(1);
    await expect(
      acceptEmployeeInvitation("worker", token),
    ).rejects.toMatchObject({ code: "BUSINESS_CONTEXT_CONFLICT" });
  });
  it("accepts once and clears the invitation secret", async () => {
    db.storeEmployeeMembership.findUnique.mockResolvedValue(invite);
    db.storeEmployeeMembership.updateMany.mockResolvedValue({ count: 1 });
    await expect(acceptEmployeeInvitation("worker", token)).resolves.toEqual({
      accepted: true,
    });
    expect(db.storeEmployeeMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "worker",
          status: "ACTIVE",
          inviteTokenHash: null,
          inviteExpiresAt: null,
        }),
      }),
    );
    expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe(
      "worker",
    );
  });
  it("rejects a concurrent/replayed acceptance", async () => {
    db.storeEmployeeMembership.findUnique.mockResolvedValue(invite);
    db.storeEmployeeMembership.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      acceptEmployeeInvitation("worker", token),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });
  it("checks the employee belongs to the owner's business before updating", async () => {
    db.store.findMany.mockResolvedValue([store]);
    db.storeEmployeeMembership.findFirst.mockResolvedValue(null);
    await expect(
      updateEmployee("owner", {
        id: "cmembership1234567890123456",
        roleLabel: "Operations",
        permissions: ["orders"],
        status: "DISABLED",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.storeEmployeeMembership.update).not.toHaveBeenCalled();
  });
  it("rejects arbitrary module names and ownership grants", () => {
    expect(
      EmployeeInviteSchema.safeParse({
        email: "worker@example.com",
        roleLabel: "Owner",
        permissions: ["employees"],
      }).success,
    ).toBe(false);
  });
});
