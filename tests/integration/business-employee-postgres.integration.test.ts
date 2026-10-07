import { beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { acceptEmployeeInvitation, inviteEmployee, updateEmployee } from "@/lib/client-platform/employees.service";
import { ownedBusiness, storeAccess } from "@/lib/client-platform/store-access";

async function foundation() {
  requireDisposableStoreSettlementDatabase();
  const tag = randomUUID();
  const owner = await prisma.user.create({ data: { email: `disposable-team-owner-${tag}@example.test`, role: "STORE", status: "ACTIVE", emailVerifiedAt: new Date() } });
  const employee = await prisma.user.create({ data: { email: `disposable-team-worker-${tag}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } });
  const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable employee lifecycle", slug: `disposable-team-${tag}`, status: "ACTIVE" } });
  const invitation = await inviteEmployee(owner.id, { email: employee.email, roleLabel: "Catalog assistant", permissions: ["products"] });
  const token = new URL(invitation.invitationPath, "https://disposable.example.test").searchParams.get("token")!;
  const membership = await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { storeId_email: { storeId: store.id, email: employee.email } } });
  return { owner, employee, store, invitation, token, membership };
}

describe("business employee lifecycle on isolated PostgreSQL", { timeout: 20_000 }, () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("binds a hashed invitation to the verified employee and preserves owner authority through disable, reactivation and removal", async () => {
    const source = await foundation();
    expect(source.membership).toMatchObject({ status: "INVITED", userId: null, inviteTokenHash: createHash("sha256").update(source.token).digest("hex"), permissions: ["products"] });
    expect(source.membership.inviteTokenHash).not.toBe(source.token);
    await expect(storeAccess(source.employee.id, "products")).rejects.toMatchObject({ code: "STORE_ACCESS_DENIED" });
    await acceptEmployeeInvitation(source.employee.id, source.token);
    const accepted = await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { id: source.membership.id } });
    expect(accepted).toMatchObject({ status: "ACTIVE", userId: source.employee.id, inviteTokenHash: null, inviteExpiresAt: null });
    expect(accepted.acceptedAt).not.toBeNull();
    expect(await storeAccess(source.employee.id, "products")).toMatchObject({ owner: false, store: { id: source.store.id }, permissions: ["products"] });
    await expect(storeAccess(source.employee.id, "finance")).rejects.toMatchObject({ code: "STORE_ACCESS_DENIED" });
    await expect(ownedBusiness(source.employee.id)).rejects.toMatchObject({ code: "STORE_OWNER_REQUIRED" });
    const update = { id: accepted.id, roleLabel: accepted.roleLabel, permissions: ["products"] as ["products"] };
    for (const status of ["DISABLED", "ACTIVE", "REMOVED"] as const) {
      await updateEmployee(source.owner.id, { ...update, status });
      if (status === "ACTIVE") expect(await storeAccess(source.employee.id, "products")).toMatchObject({ owner: false });
      else await expect(storeAccess(source.employee.id, "products")).rejects.toMatchObject({ code: "STORE_ACCESS_DENIED" });
      expect(await storeAccess(source.owner.id, "finance")).toMatchObject({ owner: true, store: { id: source.store.id } });
    }
    const logs = await prisma.adminActivityLog.findMany({ where: { entityType: "StoreEmployeeMembership", entityId: accepted.id }, orderBy: { createdAt: "asc" } });
    expect(logs).toHaveLength(5);
    expect(logs.filter(log => log.actorUserId === source.employee.id)).toHaveLength(1);
    expect(logs.filter(log => log.actorUserId === source.owner.id)).toHaveLength(4);
  });
  it("commits one concurrent acceptance and refuses reuse of the cleared token", async () => {
    const source = await foundation();
    const results = await Promise.allSettled([acceptEmployeeInvitation(source.employee.id, source.token), acceptEmployeeInvitation(source.employee.id, source.token)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "INVITATION_INVALID" });
    expect(await prisma.adminActivityLog.count({ where: { entityType: "StoreEmployeeMembership", entityId: source.membership.id, actorUserId: source.employee.id } })).toBe(1);
    await expect(acceptEmployeeInvitation(source.employee.id, source.token)).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });
  it("does not consume another email's invitation and rejects expired or unverified acceptance", async () => {
    const source = await foundation();
    const other = await prisma.user.create({ data: { email: `disposable-team-other-${randomUUID()}@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() } });
    await expect(acceptEmployeeInvitation(other.id, source.token)).rejects.toMatchObject({ code: "INVITATION_INVALID" });
    expect(await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { id: source.membership.id } })).toEqual(source.membership);
    await prisma.user.update({ where: { id: source.employee.id }, data: { emailVerifiedAt: null } });
    await expect(acceptEmployeeInvitation(source.employee.id, source.token)).rejects.toMatchObject({ code: "VERIFIED_ACCOUNT_REQUIRED" });
    await prisma.user.update({ where: { id: source.employee.id }, data: { emailVerifiedAt: new Date() } });
    await prisma.storeEmployeeMembership.update({ where: { id: source.membership.id }, data: { inviteExpiresAt: new Date(0) } });
    await expect(acceptEmployeeInvitation(source.employee.id, source.token)).rejects.toMatchObject({ code: "INVITATION_INVALID" });
    expect(await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { id: source.membership.id } })).toMatchObject({ status: "INVITED", userId: null });
  });
  it("refuses foreign-owner updates and accounts that already own another business", async () => {
    const source = await foundation();
    const other = await foundation();
    await expect(updateEmployee(other.owner.id, { id: source.membership.id, roleLabel: "Changed", permissions: ["finance"], status: "REMOVED" })).rejects.toMatchObject({ code: "EMPLOYEE_NOT_FOUND" });
    expect(await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { id: source.membership.id } })).toEqual(source.membership);
    await prisma.store.create({ data: { ownerUserId: source.employee.id, name: "Disposable conflicting business", slug: `disposable-team-conflict-${randomUUID()}`, status: "ACTIVE" } });
    await expect(acceptEmployeeInvitation(source.employee.id, source.token)).rejects.toMatchObject({ code: "BUSINESS_CONTEXT_CONFLICT" });
    expect(await prisma.storeEmployeeMembership.findUniqueOrThrow({ where: { id: source.membership.id } })).toEqual(source.membership);
  });
});
