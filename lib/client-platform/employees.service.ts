import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "./contracts";
import { ownedBusiness } from "./store-access";
import { STORE_MODULES } from "./store-permissions";
export const EmployeeInviteSchema = z
  .object({
    email: z.email().transform((v) => v.trim().toLowerCase()),
    roleLabel: z.string().trim().min(2).max(80),
    permissions: z.array(z.enum(STORE_MODULES)).max(8),
  })
  .strict();
export const EmployeeUpdateSchema = z
  .object({
    id: z.string().cuid(),
    roleLabel: z.string().trim().min(2).max(80),
    permissions: z.array(z.enum(STORE_MODULES)).max(8),
    status: z.enum(["ACTIVE", "DISABLED", "REMOVED"]),
  })
  .strict();
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function inviteEmployee(
  actorId: string,
  input: z.infer<typeof EmployeeInviteSchema>,
) {
  input = EmployeeInviteSchema.parse(input);
  const store = await ownedBusiness(actorId);
  if (store.status !== "ACTIVE")
    throw new PlatformError(
      "STORE_INACTIVE",
      "Employees require an active business.",
      409,
    );
  const token = randomBytes(32).toString("hex");
  const data = {
    ...input,
    permissions: [...new Set(input.permissions)],
    inviteTokenHash: hash(token),
    inviteExpiresAt: new Date(Date.now() + 7 * 86400000),
    status: "INVITED",
    invitedByUserId: actorId,
    userId: null,
    acceptedAt: null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employee:${store.id}:${input.email}`}))`;
    const prior = await tx.storeEmployeeMembership.findUnique({
      where: { storeId_email: { storeId: store.id, email: input.email } },
    });
    if (prior && ["ACTIVE", "DISABLED"].includes(prior.status))
      throw new PlatformError(
        "EMPLOYEE_EXISTS",
        "Edit this employee's existing access.",
        409,
      );
    const row = await tx.storeEmployeeMembership.upsert({
      where: { storeId_email: { storeId: store.id, email: input.email } },
      create: { ...data, storeId: store.id },
      update: data,
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "CREATE",
        entityType: "StoreEmployeeMembership",
        entityId: row.id,
        message: "Business employee invited",
        metadata: { storeId: store.id, permissions: input.permissions },
      },
    });
  });
  return {
    invitationPath: `/business-invitation?token=${token}`,
    expiresInDays: 7,
  }; // Owner chooses how to deliver this link; no unsolicited email.
}
export async function acceptEmployeeInvitation(userId: string, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new PlatformError(
      "INVITATION_INVALID",
      "Invitation is invalid or expired.",
      404,
    );
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`employee-user:${userId}`}))`;
    const [user, invite] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          emailVerifiedAt: true,
          status: true,
          role: true,
        },
      }),
      tx.storeEmployeeMembership.findUnique({
        where: { inviteTokenHash: hash(token) },
        include: { store: true },
      }),
    ]);
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.emailVerifiedAt ||
      !["CUSTOMER", "STORE"].includes(user.role)
    )
      throw new PlatformError(
        "VERIFIED_ACCOUNT_REQUIRED",
        "Sign in with an active, verified customer account.",
        403,
      );
    if (
      !invite ||
      invite.status !== "INVITED" ||
      !invite.inviteExpiresAt ||
      invite.inviteExpiresAt <= new Date() ||
      invite.store.status !== "ACTIVE" ||
      invite.email !== user.email.toLowerCase()
    )
      throw new PlatformError(
        "INVITATION_INVALID",
        "Sign in with the invited email address. The invitation must still be active.",
        403,
      );
    if (
      (await tx.store.count({ where: { ownerUserId: userId } })) ||
      (await tx.storeEmployeeMembership.count({
        where: { userId, status: "ACTIVE", storeId: { not: invite.storeId } },
      }))
    )
      throw new PlatformError(
        "BUSINESS_CONTEXT_CONFLICT",
        "This account already belongs to another active business.",
        409,
      );
    const changed = await tx.storeEmployeeMembership.updateMany({
      where: { id: invite.id, status: "INVITED", inviteTokenHash: hash(token) },
      data: {
        status: "ACTIVE",
        userId,
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });
    if (changed.count !== 1)
      throw new PlatformError(
        "INVITATION_INVALID",
        "This invitation was already accepted or revoked.",
        409,
      );
    await tx.adminActivityLog.create({
      data: {
        actorUserId: userId,
        action: "UPDATE",
        entityType: "StoreEmployeeMembership",
        entityId: invite.id,
        message: "Business invitation accepted",
        metadata: { storeId: invite.storeId },
      },
    });
    return { accepted: true };
  });
}
export async function updateEmployee(
  actorId: string,
  input: z.infer<typeof EmployeeUpdateSchema>,
) {
  input = EmployeeUpdateSchema.parse(input);
  const store = await ownedBusiness(actorId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.storeEmployeeMembership.findFirst({
      where: { id: input.id, storeId: store.id },
    });
    if (!row)
      throw new PlatformError("EMPLOYEE_NOT_FOUND", "Employee not found.", 404);
    if (!row.userId && input.status !== "REMOVED")
      throw new PlatformError(
        "INVITATION_UNACCEPTED",
        "This invitation must be accepted before enabling access.",
        409,
      );
    const updated = await tx.storeEmployeeMembership.update({
      where: { id: row.id },
      data: {
        roleLabel: input.roleLabel,
        permissions: [...new Set(input.permissions)],
        status: input.status,
        ...(input.status === "REMOVED"
          ? { inviteTokenHash: null, inviteExpiresAt: null }
          : {}),
      },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "UPDATE",
        entityType: "StoreEmployeeMembership",
        entityId: row.id,
        message: "Business employee access updated",
        metadata: {
          storeId: store.id,
          status: input.status,
          permissions: input.permissions,
        },
      },
    });
    return { id: updated.id, status: updated.status };
  });
}
