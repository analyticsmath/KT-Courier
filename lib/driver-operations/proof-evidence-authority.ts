import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { DriverOperationError } from "@/lib/driver-operations/errors";

type ProofEvidenceRow = Readonly<{
  id: string;
  orderId: string;
  assignmentId: string;
  driverProfileId: string;
  createdByUserId: string;
  contentType: string;
  byteSize: number;
  privateVisibility: boolean;
  status: string;
  validatedAt: Date | null;
  usedAt: Date | null;
}>;

const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const ACCEPTED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;
const SAFE_PROVIDER = /^[A-Za-z][A-Za-z0-9_-]{1,63}$/;

/**
 * Delivery media is provider-neutral. Only a completed private asset that has
 * been validated by the storage/scanning boundary can be consumed by an
 * operational command; clients cannot supply a URL or an arbitrary string.
 */
export async function consumeProofEvidenceInTx(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    reference: string | undefined;
    orderId: string;
    assignmentId: string;
    driverProfileId: string;
    driverUserId: string;
    operationId: string;
  }>,
): Promise<string | null> {
  if (!input.reference) return null;
  if (!SAFE_REFERENCE.test(input.reference)) {
    throw new DriverOperationError("Proof evidence reference is invalid.", "DRIVER_OPERATION_INVALID_STATE");
  }

  const rows = await tx.$queryRaw<ProofEvidenceRow[]>(Prisma.sql`
    SELECT "id", "orderId", "assignmentId", "driverProfileId", "createdByUserId",
      "contentType", "byteSize", "privateVisibility", "status", "validatedAt", "usedAt"
    FROM "DeliveryProofEvidence"
    WHERE "publicReference" = ${input.reference}
    FOR UPDATE
  `);
  const evidence = rows[0];
  if (!evidence) {
    throw new DriverOperationError("Proof evidence was not found.", "DRIVER_OPERATION_INVALID_STATE");
  }
  if (
    evidence.orderId !== input.orderId ||
    evidence.assignmentId !== input.assignmentId ||
    evidence.driverProfileId !== input.driverProfileId ||
    evidence.createdByUserId !== input.driverUserId ||
    evidence.status !== "READY" ||
    !evidence.validatedAt ||
    !evidence.privateVisibility ||
    evidence.usedAt ||
    !ACCEPTED_CONTENT_TYPES.has(evidence.contentType) ||
    evidence.byteSize < 1 ||
    evidence.byteSize > MAX_BYTES
  ) {
    throw new DriverOperationError("Proof evidence is not eligible for delivery use.", "DRIVER_OPERATION_INVALID_STATE");
  }

  const changed = await tx.$executeRaw(Prisma.sql`
    UPDATE "DeliveryProofEvidence"
    SET "usedAt" = CURRENT_TIMESTAMP, "usedByOperationId" = ${input.operationId}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${evidence.id} AND "usedAt" IS NULL AND "status" = 'READY'
  `);
  if (changed !== 1) {
    throw new DriverOperationError("Proof evidence has already been used.", "DRIVER_OPERATION_STALE");
  }
  return input.reference;
}

export type ValidatedProofUpload = Readonly<{
  storageProvider: string;
  storageReference: string;
  contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  byteSize: number;
}>;

/**
 * Server-side adapter boundary for a private object that has already passed
 * provider upload and scanning validation. It deliberately accepts no client
 * URL, filesystem path, scan claim, or public visibility flag.
 */
export async function registerValidatedProofUploadInTx(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    orderId: string;
    assignmentId: string;
    driverProfileId: string;
    driverUserId: string;
    upload: ValidatedProofUpload;
  }>,
): Promise<Readonly<{ evidenceReference: string }>> {
  if (
    !SAFE_PROVIDER.test(input.upload.storageProvider) ||
    !SAFE_REFERENCE.test(input.upload.storageReference) ||
    !ACCEPTED_CONTENT_TYPES.has(input.upload.contentType) ||
    !Number.isSafeInteger(input.upload.byteSize) ||
    input.upload.byteSize < 1 ||
    input.upload.byteSize > MAX_BYTES
  ) {
    throw new DriverOperationError("Validated proof upload metadata is invalid.", "DRIVER_OPERATION_INVALID_STATE");
  }
  const assignment = await tx.orderAssignment.findFirst({
    where: {
      id: input.assignmentId,
      orderId: input.orderId,
      driverProfileId: input.driverProfileId,
      status: "ACCEPTED",
      driverProfile: { userId: input.driverUserId, status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!assignment) {
    throw new DriverOperationError("Only the active assigned driver can register delivery proof.", "DRIVER_OPERATION_FORBIDDEN");
  }
  const existing = await tx.$queryRaw<Array<Readonly<{
    publicReference: string;
    orderId: string;
    assignmentId: string;
    driverProfileId: string;
    createdByUserId: string;
    storageProvider: string;
    contentType: string;
    byteSize: number;
    privateVisibility: boolean;
    status: string;
  }>>>(Prisma.sql`
    SELECT "publicReference", "orderId", "assignmentId", "driverProfileId", "createdByUserId",
      "storageProvider", "contentType", "byteSize", "privateVisibility", "status"
    FROM "DeliveryProofEvidence"
    WHERE "storageReference" = ${input.upload.storageReference}
    FOR UPDATE
  `);
  const prior = existing[0];
  if (prior) {
    if (
      prior.orderId !== input.orderId ||
      prior.assignmentId !== input.assignmentId ||
      prior.driverProfileId !== input.driverProfileId ||
      prior.createdByUserId !== input.driverUserId ||
      prior.storageProvider !== input.upload.storageProvider ||
      prior.contentType !== input.upload.contentType ||
      prior.byteSize !== input.upload.byteSize ||
      !prior.privateVisibility ||
      prior.status !== "READY"
    ) {
      throw new DriverOperationError("Proof upload reference is already bound to different evidence.", "DRIVER_OPERATION_STALE");
    }
    return Object.freeze({ evidenceReference: prior.publicReference });
  }
  const evidenceReference = `dpod_${randomUUID().replaceAll("-", "")}`;
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "DeliveryProofEvidence"
      ("id", "publicReference", "orderId", "assignmentId", "driverProfileId", "createdByUserId",
       "storageProvider", "storageReference", "contentType", "byteSize", "privateVisibility", "status", "validatedAt", "createdAt", "updatedAt")
    VALUES
      (${`dpod_${randomUUID().replaceAll("-", "")}`}, ${evidenceReference}, ${input.orderId}, ${input.assignmentId}, ${input.driverProfileId}, ${input.driverUserId},
       ${input.upload.storageProvider}, ${input.upload.storageReference}, ${input.upload.contentType}, ${input.upload.byteSize}, true, 'READY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  return Object.freeze({ evidenceReference });
}
