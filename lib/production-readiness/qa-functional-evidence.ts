import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";
import { resolveCurrentServerReleaseSha } from "@/lib/payments/sandbox-acceptance.service";
import { qaFunctionalKeys, type QaFunctionalKey } from "./acceptance-keys";

export { qaFunctionalKeys, type QaFunctionalKey };

export const QA_FUNCTIONAL_STORAGE_PREFIX = "production_qa_functional_" as const;
const sha = z.string().regex(/^[a-f0-9]{40}$/);

export const QaFunctionalDraftInputSchema = z
  .object({
    key: z.enum(qaFunctionalKeys),
    releaseSha: sha,
    qaRunReference: z.string().trim().regex(/^QARUN-[A-Z0-9]{8,40}$/),
    evidenceReference: z.string().trim().regex(/^[A-Za-z0-9:/._-]{6,200}$/),
    orderNumber: z.string().trim().min(3).max(60).optional(),
    paymentReference: z.string().trim().min(4).max(120).optional(),
    reason: z.string().trim().min(10).max(500),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const QaFunctionalReviewSchema = z
  .object({
    key: z.enum(qaFunctionalKeys),
    expectedVersion: z.number().int().positive(),
    action: z.enum(["APPROVE", "REVOKE"]),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const QaFunctionalRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("QA_FUNCTIONAL"),
    commercialLiveEquivalent: z.literal(false),
    key: z.enum(qaFunctionalKeys),
    releaseSha: sha,
    qaRunReference: z.string().min(1),
    evidenceReference: z.string().min(1),
    orderNumber: z.string().nullable(),
    paymentReference: z.string().nullable(),
    reason: z.string().min(1),
    verifiedFacts: z.record(z.string(), z.unknown()),
    version: z.number().int().positive(),
    status: z.enum(["DRAFT", "APPROVED", "REVOKED"]),
    authorId: z.string().min(1),
    approverId: z.string().nullable(),
    approvedAt: z.iso.datetime().nullable(),
    recordedAt: z.iso.datetime(),
    verificationMode: z.literal("SERVER_VERIFIED"),
    provenanceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type QaFunctionalRecord = z.infer<typeof QaFunctionalRecordSchema>;

export function qaFunctionalStorageKey(key: QaFunctionalKey): string {
  return `${QA_FUNCTIONAL_STORAGE_PREFIX}${key}`;
}

export function isQaFunctionalAcceptanceCurrent(
  record: QaFunctionalRecord | undefined,
  releaseSha: string | undefined,
): boolean {
  return Boolean(
    record &&
      record.status === "APPROVED" &&
      record.commercialLiveEquivalent === false &&
      record.verificationMode === "SERVER_VERIFIED" &&
      record.approverId &&
      record.approverId !== record.authorId &&
      record.approvedAt &&
      (!releaseSha || record.releaseSha === releaseSha),
  );
}

async function verifyQaFunctionalFactsInDb(
  db: Pick<
    Prisma.TransactionClient,
    | "qaAcceptanceRun"
    | "store"
    | "driverProfile"
    | "order"
    | "marketplaceOrder"
    | "driverEarning"
    | "storeCheckoutCertification"
    | "shipmentDocument"
  >,
  input: Readonly<{
    key: QaFunctionalKey;
    qaRunReference: string;
    orderNumber?: string;
    paymentReference?: string;
  }>,
): Promise<Record<string, unknown>> {
  const run = await db.qaAcceptanceRun.findUnique({
    where: { publicReference: input.qaRunReference },
    include: {
      store: { select: { id: true, slug: true, isQaAcceptance: true, operatingHours: true } },
      driverProfile: { select: { id: true, driverCode: true, isQaAcceptance: true, onboardingStatus: true, status: true } },
    },
  });
  if (!run || run.status === "ARCHIVED") {
    throw new PlatformError(
      "QA_FUNCTIONAL_EVIDENCE_INVALID",
      "QA functional acceptance requires an ACTIVE or COMPLETED non-archived QaAcceptanceRun.",
      409,
    );
  }

  switch (input.key) {
    case "qa_vendor_onboarding_workflow": {
      if (!run.store?.isQaAcceptance) {
        throw new PlatformError("QA_FUNCTIONAL_EVIDENCE_INVALID", "QA run is not bound to an enrolled QA store.", 409);
      }
      const cert = await db.storeCheckoutCertification.findUnique({
        where: { storeId: run.store.id },
        select: { status: true, proofOfferReference: true },
      });
      if (!cert || cert.status !== "APPROVED") {
        throw new PlatformError("QA_FUNCTIONAL_EVIDENCE_INVALID", "QA store lacks approved checkout certification.", 409);
      }
      return {
        qaRunReference: run.publicReference,
        storeId: run.store.id,
        storeSlug: run.store.slug,
        certificationStatus: cert.status,
        proofOfferReference: cert.proofOfferReference ?? null,
        nonCommercialScope: "PRIVATE_SHOP_QA_ONLY",
      };
    }

    case "qa_driver_onboarding_workflow": {
      if (!run.driverProfile?.isQaAcceptance || run.driverProfile.onboardingStatus !== "APPROVED") {
        throw new PlatformError("QA_FUNCTIONAL_EVIDENCE_INVALID", "QA run lacks an approved enrolled QA driver.", 409);
      }
      return {
        qaRunReference: run.publicReference,
        driverProfileId: run.driverProfile.id,
        driverCode: run.driverProfile.driverCode,
        driverStatus: run.driverProfile.status,
        nonCommercialScope: "QA_SANDBOX_DRIVER_ONLY",
      };
    }

    case "qa_driver_simulated_gps_workflow": {
      const order = await db.order.findFirst({
        where: {
          isQaAcceptance: true,
          qaAcceptanceRunId: run.id,
          ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
          assignments: {
            some: {
              status: "COMPLETED",
              locationEvidence: { some: { source: "QA_SIMULATED" } },
            },
          },
        },
        include: {
          assignments: {
            where: { status: "COMPLETED" },
            include: { locationEvidence: { where: { source: "QA_SIMULATED" }, take: 5 } },
            take: 1,
          },
        },
      });
      if (!order || order.assignments.length === 0) {
        throw new PlatformError(
          "QA_FUNCTIONAL_EVIDENCE_INVALID",
          "No completed QA order with persisted QA_SIMULATED location evidence was found for this run.",
          409,
        );
      }
      return {
        qaRunReference: run.publicReference,
        orderNumber: order.orderNumber,
        locationSource: "QA_SIMULATED",
        locationEvidenceCount: order.assignments[0].locationEvidence.length,
        doesNotSatisfyPhysicalDeviceGps: true,
      };
    }

    case "qa_pod_otp_pdf_workflow": {
      const order = await db.order.findFirst({
        where: {
          isQaAcceptance: true,
          qaAcceptanceRunId: run.id,
          status: { in: ["DELIVERED", "COMPLETED"] },
          ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
          assignments: { some: { status: "COMPLETED", proofOfDelivery: { isNot: null } } },
        },
        include: {
          shipmentDocuments: { where: { status: "ISSUED" }, select: { type: true, documentRef: true } },
        },
      });
      if (!order || order.shipmentDocuments.length === 0) {
        throw new PlatformError(
          "QA_FUNCTIONAL_EVIDENCE_INVALID",
          "No delivered QA order with ProofOfDelivery and issued ShipmentDocuments was found for this run.",
          409,
        );
      }
      return {
        qaRunReference: run.publicReference,
        orderNumber: order.orderNumber,
        documentTypes: order.shipmentDocuments.map((d) => d.type),
        documentRefs: order.shipmentDocuments.map((d) => d.documentRef),
      };
    }

    case "qa_marketplace_checkout_sandbox_workflow": {
      const mkt = await db.marketplaceOrder.findFirst({
        where: {
          isQaAcceptance: true,
          qaAcceptanceRunId: run.id,
          payment: {
            status: "SUCCEEDED",
            ...(input.paymentReference ? { publicReference: input.paymentReference } : {}),
          },
        },
        include: {
          payment: { select: { publicReference: true, amount: true, currency: true, provider: true } },
        },
      });
      if (!mkt) {
        throw new PlatformError(
          "QA_FUNCTIONAL_EVIDENCE_INVALID",
          "No paid QA marketplace order was found for this QA acceptance run.",
          409,
        );
      }
      return {
        qaRunReference: run.publicReference,
        marketplaceOrderReference: mkt.publicReference,
        paymentReference: mkt.payment.publicReference,
        amountZar: mkt.payment.amount.toFixed(2),
        provider: mkt.payment.provider,
        sandboxModeOnly: true,
      };
    }

    case "qa_isolated_settlement_workflow": {
      const earning = await db.driverEarning.findFirst({
        where: {
          isQaAcceptance: true,
          order: { qaAcceptanceRunId: run.id },
          ...(input.orderNumber ? { orderPublicReference: input.orderNumber } : {}),
        },
        include: {
          wallet: { select: { isQaIsolated: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!earning || !earning.wallet.isQaIsolated) {
        throw new PlatformError(
          "QA_FUNCTIONAL_EVIDENCE_INVALID",
          "No settled isolated QA DriverEarning was found for this QA acceptance run.",
          409,
        );
      }
      return {
        qaRunReference: run.publicReference,
        driverEarningReference: earning.publicReference,
        orderNumber: earning.orderPublicReference,
        netAmountZar: earning.amount.toFixed(2),
        settlementVersion: earning.settlementVersion,
        isQaIsolatedWallet: true,
      };
    }
  }
}

export async function listQaFunctionalAcceptanceEvidence(): Promise<QaFunctionalRecord[]> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: QA_FUNCTIONAL_STORAGE_PREFIX } },
    orderBy: { key: "asc" },
  });
  const records: QaFunctionalRecord[] = [];
  for (const row of rows) {
    const parsed = QaFunctionalRecordSchema.safeParse(row.value);
    if (parsed.success) records.push(parsed.data);
  }
  return records;
}

export async function recordQaFunctionalEvidence(
  actorId: string,
  input: z.infer<typeof QaFunctionalDraftInputSchema>,
  env: Record<string, string | undefined> = process.env,
): Promise<QaFunctionalRecord> {
  const data = QaFunctionalDraftInputSchema.parse(input);
  const serverSha = resolveCurrentServerReleaseSha(env);
  if (serverSha && data.releaseSha !== serverSha) {
    throw new PlatformError(
      "RELEASE_SHA_MISMATCH",
      "QA functional acceptance release SHA does not match running release.",
      409,
    );
  }
  const key = qaFunctionalStorageKey(data.key);
  const verifiedFacts = await verifyQaFunctionalFactsInDb(prisma, {
    key: data.key,
    qaRunReference: data.qaRunReference,
    orderNumber: data.orderNumber,
    paymentReference: data.paymentReference,
  });

  const digest = createHash("sha256")
    .update(JSON.stringify({ key: data.key, releaseSha: data.releaseSha, verifiedFacts }))
    .digest("hex");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key } });
    const parsedPrior = prior ? QaFunctionalRecordSchema.safeParse(prior.value) : null;
    const version = parsedPrior?.success ? parsedPrior.data.version : 0;
    if (version !== data.expectedVersion) {
      throw new PlatformError("EVIDENCE_CONFLICT", "Refresh QA functional acceptance before saving.", 409);
    }

    const record: QaFunctionalRecord = {
      schemaVersion: 1,
      kind: "QA_FUNCTIONAL",
      commercialLiveEquivalent: false,
      key: data.key,
      releaseSha: data.releaseSha,
      qaRunReference: data.qaRunReference,
      evidenceReference: data.evidenceReference,
      orderNumber: data.orderNumber ?? null,
      paymentReference: data.paymentReference ?? null,
      reason: data.reason,
      verifiedFacts,
      version: version + 1,
      status: "DRAFT",
      authorId: actorId,
      approverId: null,
      approvedAt: null,
      recordedAt: new Date().toISOString(),
      verificationMode: "SERVER_VERIFIED",
      provenanceDigest: digest,
    };

    await tx.systemSetting.upsert({
      where: { key },
      create: {
        key,
        type: "JSON",
        label: "QA functional acceptance evidence (non-commercial)",
        value: record as unknown as Prisma.InputJsonValue,
      },
      update: {
        value: record as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "CREATE",
        entityType: "ProductionQaFunctionalAcceptance",
        entityId: key,
        message: `[QA_FUNCTIONAL] ${data.reason}`,
        metadata: record as unknown as Prisma.InputJsonValue,
      },
    });
    return record;
  });
}

export async function reviewQaFunctionalEvidence(
  actorId: string,
  input: z.infer<typeof QaFunctionalReviewSchema>,
): Promise<QaFunctionalRecord> {
  const data = QaFunctionalReviewSchema.parse(input);
  const key = qaFunctionalStorageKey(data.key);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const row = await tx.systemSetting.findUnique({ where: { key } });
    const parsedPrior = row ? QaFunctionalRecordSchema.safeParse(row.value) : null;
    if (!row || !parsedPrior?.success || parsedPrior.data.version !== data.expectedVersion) {
      throw new PlatformError("EVIDENCE_CONFLICT", "Refresh QA functional acceptance before reviewing.", 409);
    }
    const prior = parsedPrior.data;
    if (data.action === "APPROVE") {
      if (prior.authorId === actorId || prior.status !== "DRAFT") {
        throw new PlatformError(
          "INDEPENDENT_REVIEW_REQUIRED",
          "A different authorized administrator must approve QA functional acceptance.",
          403,
        );
      }
      await verifyQaFunctionalFactsInDb(tx, {
        key: prior.key,
        qaRunReference: prior.qaRunReference,
        orderNumber: prior.orderNumber ?? undefined,
        paymentReference: prior.paymentReference ?? undefined,
      });
    }

    const next: QaFunctionalRecord = {
      ...prior,
      version: prior.version + 1,
      status: data.action === "APPROVE" ? "APPROVED" : "REVOKED",
      approverId: actorId,
      approvedAt: new Date().toISOString(),
    };
    await tx.systemSetting.update({
      where: { id: row.id, updatedAt: row.updatedAt },
      data: { value: next as unknown as Prisma.InputJsonValue },
    });
    await tx.adminActivityLog.create({
      data: {
        actorUserId: actorId,
        action: "UPDATE",
        entityType: "ProductionQaFunctionalAcceptance",
        entityId: key,
        message: `[QA_FUNCTIONAL_${data.action}] ${data.reason}`,
        metadata: { before: row.value, after: next as unknown as Prisma.InputJsonValue },
      },
    });
    return next;
  });
}
