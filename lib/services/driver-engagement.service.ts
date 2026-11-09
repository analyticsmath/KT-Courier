import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const DriverEngagementSchema = z.object({
  engagementType: z.enum(["FREELANCE", "SALARIED"]),
  contractReference: z.string().trim().regex(
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{11,119}$/,
    "Record an approved contract evidence reference (12–120 characters).",
  ),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date (YYYY-MM-DD)."),
  expectedRevision: z.number().int().nonnegative(),
  reason: z.string().trim().min(25).max(750),
}).strict().superRefine((value, context) => {
  const parsed = new Date(value.effectiveFrom + "T00:00:00.000Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.effectiveFrom) {
    context.addIssue({ code: "custom", path: ["effectiveFrom"], message: "Enter a real calendar date." });
  }
});

export class DriverEngagementConflict extends Error {
  readonly code = "DRIVER_ENGAGEMENT_CHANGED";
  constructor() { super("Driver engagement was changed by another administrator. Reload before saving."); }
}

/** An engagement decision is an audited fact, not salary or per-delivery pay authority. */
export async function setDriverEngagement(driverId: string, actorId: string, raw: z.input<typeof DriverEngagementSchema>) {
  const input = DriverEngagementSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DriverProfile" WHERE "id" = ${driverId} FOR UPDATE`);
    const prior = await tx.driverProfile.findUnique({ where: { id: driverId }, select: {
      engagementType: true, engagementContractReference: true, engagementEffectiveFrom: true,
      engagementRevision: true,
    } });
    if (!prior) return null;
    if (prior.engagementRevision !== input.expectedRevision) throw new DriverEngagementConflict();
    // South African local civil start; date-only selection is not interpreted
    // according to the browser or administrator's local timezone.
    const effectiveFrom = new Date(input.effectiveFrom + "T00:00:00.000+02:00");
    const updated = await tx.driverProfile.update({ where: { id: driverId }, data: {
      engagementType: input.engagementType,
      engagementContractReference: input.contractReference,
      engagementEffectiveFrom: effectiveFrom,
      engagementRevision: { increment: 1 },
    }, select: { engagementType: true, engagementContractReference: true,
      engagementEffectiveFrom: true, engagementRevision: true } });
    await tx.adminActivityLog.create({ data: {
      actorUserId: actorId, action: "UPDATE", entityType: "Driver", entityId: driverId,
      message: "Driver engagement contract classification updated",
      metadata: {
        oldType: prior.engagementType, newType: updated.engagementType,
        oldContractReference: prior.engagementContractReference,
        contractReference: updated.engagementContractReference,
        oldEffectiveFrom: prior.engagementEffectiveFrom?.toISOString() ?? null,
        effectiveFrom: effectiveFrom.toISOString(),
        oldRevision: prior.engagementRevision, newRevision: updated.engagementRevision,
        reason: input.reason,
        payrollAndDriverEarningsUnchanged: true,
      },
    } });
    return {
      type: updated.engagementType, reference: updated.engagementContractReference,
      effectiveFrom: input.effectiveFrom, revision: updated.engagementRevision,
      remunerationPolicyActivated: false,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
