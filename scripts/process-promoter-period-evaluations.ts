/* Periodic promoter qualification job. The scheduler supplies a stable YYYY-MM period and operation namespace. */
import { prisma } from "@/lib/db/prisma";
import { PromoterTeamQualificationService } from "@/lib/promoters/team-qualification.service";
const periodKey = process.argv[2] ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 7);
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) throw new Error("Usage: tsx scripts/process-promoter-period-evaluations.ts YYYY-MM");
const service = new PromoterTeamQualificationService(prisma);
const enrollments = await prisma.promoterEnrollment.findMany({ where: { status: "ACTIVE", programVersion: { status: "ACTIVE" } }, select: { promoterAccountId: true, programVersionId: true } });
for (const enrollment of enrollments) await service.evaluatePeriod({ promoterAccountId: enrollment.promoterAccountId, programVersionId: enrollment.programVersionId, periodKey, operationId: `promoter-period:${periodKey}:${enrollment.promoterAccountId}:${enrollment.programVersionId}` });
