/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { executeRetentionTarget, resolveRetentionPolicy, RetentionError } from "./privacy-retention.service";

/** Scheduler/outbox entry point. It makes each resource claim idempotent through RetentionExecution.executionKey. */
export async function runPrivacyRetentionWorker(input: { operationId: string; actorReference?: string; batchSize?: number }) {
  let activePolicy;
  try { activePolicy = await resolveRetentionPolicy("PRIVATE_MEDIA"); }
  catch (error) { if (error instanceof RetentionError && error.code === "RETENTION_POLICY_NOT_FOUND") return { examined: 0, outcomes: [] }; throw error; }
  if (activePolicy.action !== "DELETE" || !Number.isInteger(activePolicy.retentionDays) || Number(activePolicy.retentionDays) < 0) return { examined: 0, outcomes: [] };
  const client = db as any; const limit = Math.min(input.batchSize ?? 50, 200);
  const now = new Date();
  const createdBefore = new Date(now.getTime() - Number(activePolicy.retentionDays) * 86_400_000);
  const media = await client.privateMediaObject.findMany({
    where: {
      deletedAt: null,
      status: { in: ["READY", "RETAINED", "DELETE_REQUESTED"] },
      createdAt: { lte: createdBefore },
      OR: [{ retentionUntil: null }, { retentionUntil: { lte: now } }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  const outcomes = [];
  for (const object of media) outcomes.push(await executeRetentionTarget({ dataClass: "PRIVATE_MEDIA", resourceType: "PrivateMediaObject", resourceReference: object.publicReference, resourceCreatedAt: object.createdAt, subjectType: object.ownerType, subjectReference: object.ownerId, operationId: `${input.operationId}:${object.id}`, actorReference: input.actorReference ?? "RETENTION_WORKER" }));
  return { examined: media.length, outcomes };
}
