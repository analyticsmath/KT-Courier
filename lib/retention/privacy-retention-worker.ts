/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { executeRetentionTarget } from "./privacy-retention.service";
import { phase5Repository } from "@/lib/operations/phase5-repository";

/** Scheduler/outbox entry point. It makes each resource claim idempotent through RetentionExecution.executionKey. */
export async function runPrivacyRetentionWorker(input: { operationId: string; actorReference?: string; batchSize?: number }) {
  const activePolicy = await phase5Repository.retentionPolicyVersion.findFirst({ where: { dataClass: "PRIVATE_MEDIA", status: "ACTIVE" } });
  if (!activePolicy) return { examined: 0, outcomes: [] };
  const client = db as any; const limit = Math.min(input.batchSize ?? 50, 200);
  const media = await client.privateMediaObject.findMany({ where: { deletedAt: null, retentionUntil: { lte: new Date() } }, orderBy: { retentionUntil: "asc" }, take: limit });
  const outcomes = [];
  for (const object of media) outcomes.push(await executeRetentionTarget({ dataClass: "PRIVATE_MEDIA", resourceType: "PrivateMediaObject", resourceReference: object.publicReference, resourceCreatedAt: object.retentionUntil ?? object.createdAt, subjectType: object.ownerType, subjectReference: object.ownerId, operationId: `${input.operationId}:${object.id}`, actorReference: input.actorReference ?? "RETENTION_WORKER" }));
  return { examined: media.length, outcomes };
}
