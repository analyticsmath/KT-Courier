import { prisma } from "@/lib/db/prisma";
import { processConsentWithdrawal } from "@/lib/services/privacy-requests.service";

/** Recover only a workflow started by this processor; administrator decisions remain separate. */
export async function runConsentWithdrawalBatch(input: { mode: "DRY_RUN" | "APPLY"; batchSize: number }) {
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 50) throw new Error("Invalid privacy batch size.");
  const candidates = await prisma.$queryRaw<Array<{ id: string; publicReference: string; requesterUserId: string; status: string }>>`
    SELECT r."id", r."publicReference", r."requesterUserId", r."status"
    FROM "PrivacyRequest" r
    WHERE r."requestType" = 'CONSENT_WITHDRAWAL'
      AND r."requesterUserId" IS NOT NULL
      AND r."identityVerificationStatus" = 'AUTHENTICATED'
      AND (
        r."status" = 'SUBMITTED'
        OR (r."status" IN ('UNDER_REVIEW', 'APPROVED', 'PROCESSING') AND EXISTS (
          SELECT 1 FROM "PrivacyRequestEvent" e
          WHERE e."privacyRequestId" = r."id" AND e."actorUserId" = r."requesterUserId"
            AND e."operationId" = 'privacy-consent:' || r."id" || CASE r."status"
              WHEN 'UNDER_REVIEW' THEN ':REVIEW' WHEN 'APPROVED' THEN ':APPROVED' ELSE ':PROCESSING' END
            AND e."eventType" = r."status"
        ))
      )
    ORDER BY r."createdAt", r."id" LIMIT ${input.batchSize}`;
  let completed = 0;
  if (input.mode === "APPLY") {
    for (const candidate of candidates) {
      await processConsentWithdrawal({ actorUserId: candidate.requesterUserId, publicReference: candidate.publicReference, operationId: `privacy-consent:${candidate.id}` });
      completed++;
    }
  }
  return { itemsExamined: candidates.length, itemsClaimed: completed, itemsCompleted: completed, itemsSkipped: input.mode === "DRY_RUN" ? candidates.length : 0, itemsRetried: candidates.filter(candidate => candidate.status !== "SUBMITTED").length, itemsReconciled: 0, safeSummary: `Consent withdrawals: ${completed} completed.` };
}
