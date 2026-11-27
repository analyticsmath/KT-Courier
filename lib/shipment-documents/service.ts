import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  captureIssuerSnapshotInTx,
  CompanyProfileRequiredError,
  currentCompanyProfileWithDb,
} from "@/lib/services/company-profile.service";
import { getCourierPaymentReadiness } from "@/lib/services/courier-payment-readiness.service";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import type { AuthenticatedUser } from "@/types/domain";
import {
  authorizeShipmentDocumentAccess,
  type AuthorizedShipmentOrderContext,
} from "./authorization";
import {
  SHIPMENT_DOCUMENT_RENDERER_VERSION,
  ShipmentDocumentError,
  type ShipmentDocumentKind,
  type ShipmentPodPayload,
  type ShipmentWaybillPayload,
} from "./contracts";
import {
  buildPodPayload,
  buildWaybillPayload,
  computePayloadSha256,
  extractIssuerSnapshot,
  sanitizePayloadForViewerRole,
  type DocumentOrderRecord,
} from "./projection";
import { renderShipmentDocumentPdf } from "./render-pdf";

type DocumentDb = Prisma.TransactionClient | typeof prisma;

const WAYBILL_ALLOWED_STATUSES = new Set([
  "CONFIRMED",
  "DISPATCHED",
  "DRIVER_ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERY_ATTEMPTED",
  "DELIVERED",
  "COMPLETED",
  "DELIVERY_FAILED",
]);

const POD_ALLOWED_STATUSES = new Set(["DELIVERED", "COMPLETED"]);

const DOCUMENT_ORDER_SELECT = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  orderNumber: true,
  source: true,
  status: true,
  deliveryType: true,
  currency: true,
  createdAt: true,
  scheduledFor: true,
  parcelCount: true,
  parcelDescription: true,
  customerNote: true,
  pricingSnapshot: true,
  isQaAcceptance: true,
  recipientName: true,
  recipientPhone: true,
  priceEstimate: true,
  distanceMeters: true,
  pickupAddress: {
    select: {
      contactName: true,
      contactPhone: true,
      line1: true,
      line2: true,
      suburb: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      accessNotes: true,
    },
  },
  dropoffAddress: {
    select: {
      contactName: true,
      contactPhone: true,
      line1: true,
      line2: true,
      suburb: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,
      accessNotes: true,
    },
  },
  customer: { select: { name: true, email: true } },
  store: { select: { name: true, contactEmail: true } },
  statusHistory: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { status: true, createdAt: true },
  },
  cashOnDelivery: {
    select: {
      policyMode: true,
      status: true,
      authoritativePayable: true,
      digitalPaid: true,
      cashObligation: true,
      cashCollected: true,
    },
  },
  payments: {
    where: { subjectType: "COURIER_ORDER", status: "SUCCEEDED" },
    orderBy: [{ succeededAt: "desc" }, { createdAt: "desc" }],
    take: 2,
    select: {
      status: true,
      amount: true,
      metadata: true,
      succeededAt: true,
    },
  },
  marketplaceStoreOrderBridge: {
    select: {
      storeOrder: { select: { publicReference: true } },
    },
  },
  proofOfDelivery: {
    select: {
      id: true,
      method: true,
      recipientName: true,
      recipientPhone: true,
      otpVerifiedAt: true,
      deliveredAt: true,
      publicNote: true,
      internalNote: true,
      evidenceReference: true,
      assignment: {
        select: {
          locationEvidence: {
            where: { validationStatus: "ACCEPTED" },
            orderBy: [{ clientCapturedAt: "desc" }, { receivedAt: "desc" }],
            take: 1,
            select: { source: true },
          },
        },
      },
      driverProfile: {
        select: {
          id: true,
          displayName: true,
          user: { select: { name: true } },
        },
      },
    },
  },
});

function makeDocumentRef(type: ShipmentDocumentKind, orderNumber: string, revision: number): string {
  const prefix = type === "WAYBILL" ? "WB" : "POD";
  const cleanedOrder = orderNumber.replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  const entropy = randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${cleanedOrder}-R${revision}-${entropy}`;
}

async function assertOrderEligibleForDocument(
  db: DocumentDb,
  order: DocumentOrderRecord,
  type: ShipmentDocumentKind,
): Promise<void> {
  if (type === "WAYBILL") {
    if (!WAYBILL_ALLOWED_STATUSES.has(order.status)) {
      throw new ShipmentDocumentError(
        "WAYBILL_NOT_ELIGIBLE",
        409,
        "Official waybill is issued only after booking confirmation or payment verification is complete.",
      );
    }

    const isMarketplaceBridged = Boolean(order.marketplaceStoreOrderBridge);
    if (!isMarketplaceBridged) {
      const readiness = await getCourierPaymentReadiness(order.id, db as Parameters<typeof getCourierPaymentReadiness>[1]);
      const financiallyAuthorized =
        readiness.dispatchEligible ||
        ["PAID", "DEPOSIT_PAID_CASH_DUE", "CASH_DUE_ON_DELIVERY", "CASH_COLLECTED", "CASH_RECONCILED"].includes(
          readiness.status,
        );
      if (!financiallyAuthorized) {
        throw new ShipmentDocumentError(
          "WAYBILL_NOT_ELIGIBLE",
          409,
          "Waybill cannot be issued until payment or deposit verification is complete.",
        );
      }
    }
    return;
  }

  if (!POD_ALLOWED_STATUSES.has(order.status) || !order.proofOfDelivery) {
    throw new ShipmentDocumentError(
      "POD_PROOF_MISSING",
      409,
      "Official Proof of Delivery is only available once the shipment is delivered with a verified delivery proof record.",
    );
  }
}

export interface IssueShipmentDocumentResult {
  documentId: string;
  documentRef: string;
  revision: number;
  type: ShipmentDocumentKind;
  created: boolean;
  supersededPrevious: boolean;
}

export async function issueShipmentDocumentInTx(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    type: ShipmentDocumentKind;
    actorUserId?: string | null;
    actorRole?: string | null;
    sourceEventRef?: string | null;
    revisionReason?: string | null;
    allowSupersede?: boolean;
  },
): Promise<IssueShipmentDocumentResult> {
  // Serialize issuance per order so concurrent confirmation/POD handlers never double-issue.
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${args.orderId} FOR UPDATE`;

  const order = await tx.order.findUnique({
    where: { id: args.orderId },
    select: DOCUMENT_ORDER_SELECT,
  });
  if (!order) {
    throw new ShipmentDocumentError("ORDER_NOT_FOUND", 404, "Shipment order was not found.");
  }

  await assertOrderEligibleForDocument(tx, order, args.type);

  const existingIssued = await tx.shipmentDocument.findFirst({
    where: { orderId: order.id, type: args.type, status: "ISSUED" },
    orderBy: [{ revision: "desc" }],
  });

  if (existingIssued && !args.allowSupersede) {
    return {
      documentId: existingIssued.id,
      documentRef: existingIssued.documentRef,
      revision: existingIssued.revision,
      type: args.type,
      created: false,
      supersededPrevious: false,
    };
  }

  const latestRevisionRow = await tx.shipmentDocument.findFirst({
    where: { orderId: order.id, type: args.type },
    orderBy: [{ revision: "desc" }],
    select: { revision: true },
  });
  const nextRevision = (latestRevisionRow?.revision ?? 0) + 1;
  const documentRef = makeDocumentRef(args.type, order.orderNumber, nextRevision);
  const issuerRef = `${args.type}:${order.orderNumber}:R${nextRevision}`;

  let issuerRow;
  try {
    issuerRow = await captureIssuerSnapshotInTx(tx, {
      documentType: args.type,
      documentReference: issuerRef,
    });
  } catch (err) {
    if (err instanceof CompanyProfileRequiredError) {
      throw new ShipmentDocumentError(
        "COMPANY_PROFILE_REQUIRED",
        409,
        err.message,
        err.actionHref,
      );
    }
    throw err;
  }

  const issuer = extractIssuerSnapshot(issuerRow);
  const issuedAt = new Date();
  const payload =
    args.type === "WAYBILL"
      ? buildWaybillPayload({
          order,
          issuer,
          documentRef,
          revision: nextRevision,
          issuedAt,
        })
      : buildPodPayload({
          order,
          issuer,
          documentRef,
          revision: nextRevision,
          issuedAt,
        });

  // Compute deterministic content hash excluding generated documentRef/issuedAt/revision
  // so allowSupersede only creates a new revision if underlying shipment/issuer facts changed.
  const stableFingerprintInput =
    payload.kind === "WAYBILL"
      ? { ...payload, documentRef: "", revision: 0, issuedAtIso: "", issuedAtSast: "" }
      : { ...payload, documentRef: "", revision: 0, issuedAtIso: "", issuedAtSast: "" };
  const payloadSha256 = computePayloadSha256(stableFingerprintInput);

  if (existingIssued && existingIssued.payloadSha256 === payloadSha256) {
    return {
      documentId: existingIssued.id,
      documentRef: existingIssued.documentRef,
      revision: existingIssued.revision,
      type: args.type,
      created: false,
      supersededPrevious: false,
    };
  }

  let supersededPrevious = false;
  if (existingIssued) {
    await tx.shipmentDocument.update({
      where: { id: existingIssued.id },
      data: { status: "SUPERSEDED" },
    });
    supersededPrevious = true;
  }

  const createdDoc = await tx.shipmentDocument.create({
    data: {
      documentRef,
      orderId: order.id,
      type: args.type,
      revision: nextRevision,
      status: "ISSUED",
      issuerSnapshotId: issuerRow.id,
      proofOfDeliveryId: args.type === "POD" ? order.proofOfDelivery?.id ?? null : null,
      payloadSnapshot: payload as unknown as Prisma.InputJsonValue,
      payloadSha256,
      rendererVersion: SHIPMENT_DOCUMENT_RENDERER_VERSION,
      sourceEventRef: args.sourceEventRef?.slice(0, 160) ?? null,
      issuedByUserId: args.actorUserId ?? null,
      issuedByRole: args.actorRole ?? null,
      issuedAt,
      supersedesId: existingIssued?.id ?? null,
      revisionReason: args.revisionReason?.slice(0, 300) ?? null,
    },
  });

  return {
    documentId: createdDoc.id,
    documentRef: createdDoc.documentRef,
    revision: createdDoc.revision,
    type: args.type,
    created: true,
    supersededPrevious,
  };
}

/**
 * Issues a ShipmentDocument inside a PostgreSQL SAVEPOINT during financial confirmation
 * or delivery completion so missing company profile setup never rolls back payment
 * settlement or physical POD confirmation; admins/owners can recover it via /admin/company-profile.
 */
export async function issueShipmentDocumentBestEffortInTx(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    type: ShipmentDocumentKind;
    actorUserId?: string | null;
    actorRole?: string | null;
    sourceEventRef?: string | null;
  },
): Promise<{ ok: true; result: IssueShipmentDocumentResult } | { ok: false; code: string; message: string }> {
  const spName = `kt_issue_${args.type.toLowerCase()}`;
  const hasRaw = typeof (tx as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === "function";

  if (hasRaw) {
    await tx.$executeRawUnsafe(`SAVEPOINT ${spName}`);
  }
  try {
    const result = await issueShipmentDocumentInTx(tx, args);
    if (hasRaw) {
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${spName}`);
    }
    return { ok: true, result };
  } catch (error) {
    if (hasRaw) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${spName}`);
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${spName}`);
    }
    const code = error instanceof ShipmentDocumentError ? error.code : "DOCUMENT_ISSUANCE_DEFERRED";
    const message = error instanceof Error ? error.message : "Shipment document issuance deferred.";
    if (code !== "COMPANY_PROFILE_REQUIRED") {
      console.warn("SHIPMENT_DOCUMENT_BEST_EFFORT_DEFERRED", { orderId: args.orderId, type: args.type, code, message });
    }
    return {
      ok: false,
      code,
      message,
    };
  }
}

export async function recoverOrIssueShipmentDocument(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  type: ShipmentDocumentKind;
  allowSupersede?: boolean;
  revisionReason?: string | null;
  explicitStoreId?: string | null;
}): Promise<{ context: AuthorizedShipmentOrderContext; result: IssueShipmentDocumentResult }> {
  const context = await authorizeShipmentDocumentAccess({
    user: args.user,
    orderId: args.orderId,
    action: "RECOVER",
    explicitStoreId: args.explicitStoreId,
  });

  const result = await withPaymentDatabaseRetry(() =>
    prisma.$transaction(async (tx) =>
      issueShipmentDocumentInTx(tx, {
        orderId: context.orderId,
        type: args.type,
        actorUserId: context.actorUserId,
        actorRole: context.viewerRole,
        sourceEventRef: `recovery:${args.type}:${context.actorUserId}`,
        revisionReason:
          args.revisionReason ??
          (args.allowSupersede ? "Manual re-issue requested after profile or order update" : "Scoped document recovery"),
        allowSupersede: Boolean(args.allowSupersede),
      }),
    ),
  );

  return { context, result };
}

export async function downloadAuthorizedShipmentDocumentPdf(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  type: ShipmentDocumentKind;
  explicitStoreId?: string | null;
}): Promise<{
  bytes: Uint8Array;
  fileName: string;
  documentRef: string;
  revision: number;
  orderNumber: string;
}> {
  const context = await authorizeShipmentDocumentAccess({
    user: args.user,
    orderId: args.orderId,
    action: args.type,
    explicitStoreId: args.explicitStoreId,
  });

  // Always check order state + eligibility before issuing or streaming historical snapshot.
  const order = await prisma.order.findUnique({
    where: { id: context.orderId },
    select: DOCUMENT_ORDER_SELECT,
  });
  if (!order) {
    throw new ShipmentDocumentError("ORDER_NOT_FOUND", 404, "Shipment order was not found.");
  }

  let docRow = await prisma.shipmentDocument.findFirst({
    where: { orderId: context.orderId, type: args.type, status: "ISSUED" },
    orderBy: [{ revision: "desc" }],
  });

  if (!docRow) {
    // Eligible confirmed or delivered order created prior to document table rollout:
    // materialize an immutable snapshot once when active CompanyProfileVersion exists.
    await assertOrderEligibleForDocument(prisma, order, args.type);
    const issued = await withPaymentDatabaseRetry(() =>
      prisma.$transaction((tx) =>
        issueShipmentDocumentInTx(tx, {
          orderId: context.orderId,
          type: args.type,
          actorUserId: context.actorUserId,
          actorRole: context.viewerRole,
          sourceEventRef: `lazy-issue:${args.type}:${context.viewerRole}`,
        }),
      ),
    );
    docRow = await prisma.shipmentDocument.findUnique({ where: { id: issued.documentId } });
  } else if (args.type === "POD" && !docRow.proofOfDeliveryId) {
    throw new ShipmentDocumentError(
      "DOCUMENT_INTEGRITY_ERROR",
      409,
      "Stored POD document lacks a verified ProofOfDelivery link.",
    );
  }

  if (!docRow) {
    throw new ShipmentDocumentError("DOCUMENT_NOT_FOUND", 404, "Requested shipment document was not found.");
  }

  const storedPayload = docRow.payloadSnapshot as unknown as ShipmentWaybillPayload | ShipmentPodPayload;
  if (!storedPayload || storedPayload.kind !== args.type) {
    throw new ShipmentDocumentError(
      "DOCUMENT_INTEGRITY_ERROR",
      500,
      "Stored shipment document payload failed integrity check.",
    );
  }

  const authoritativePayload: ShipmentWaybillPayload | ShipmentPodPayload =
    (order as { isQaAcceptance?: boolean }).isQaAcceptance
      ? { ...storedPayload, isQaAcceptance: true }
      : storedPayload;
  const viewerPayload = sanitizePayloadForViewerRole(authoritativePayload, context.viewerRole);
  const bytes = await renderShipmentDocumentPdf(viewerPayload);
  const safeRef = order.orderNumber.replace(/[^A-Za-z0-9-]/g, "");
  const fileName =
    args.type === "WAYBILL"
      ? `KT-Couriers-Waybill-${safeRef}-R${docRow.revision}.pdf`
      : `KT-Couriers-Proof-Of-Delivery-${safeRef}-R${docRow.revision}.pdf`;

  return {
    bytes,
    fileName,
    documentRef: docRow.documentRef,
    revision: docRow.revision,
    orderNumber: order.orderNumber,
  };
}

export interface OrderDocumentAvailabilitySummary {
  hasActiveCompanyProfile: boolean;
  waybill: {
    eligible: boolean;
    issued: boolean;
    documentRef: string | null;
    revision: number | null;
    issuedAtIso: string | null;
    reasonUnavailable: string | null;
  };
  pod: {
    eligible: boolean;
    issued: boolean;
    documentRef: string | null;
    revision: number | null;
    issuedAtIso: string | null;
    proofMethod: string | null;
    reasonUnavailable: string | null;
  };
}

export async function getOrderDocumentAvailability(orderId: string): Promise<OrderDocumentAvailabilitySummary> {
  const [company, order, issuedDocs] = await Promise.all([
    currentCompanyProfileWithDb(prisma),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        marketplaceStoreOrderBridge: { select: { id: true } },
        proofOfDelivery: { select: { id: true, method: true } },
      },
    }),
    prisma.shipmentDocument.findMany({
      where: { orderId, status: "ISSUED" },
      select: { type: true, documentRef: true, revision: true, issuedAt: true },
    }),
  ]);

  const waybillDoc = issuedDocs.find((d) => d.type === "WAYBILL") ?? null;
  const podDoc = issuedDocs.find((d) => d.type === "POD") ?? null;

  let waybillEligible = Boolean(order && WAYBILL_ALLOWED_STATUSES.has(order.status));
  let waybillReason: string | null = null;
  if (!order) {
    waybillEligible = false;
    waybillReason = "Order unavailable.";
  } else if (!waybillEligible) {
    waybillReason =
      order.status === "PENDING"
        ? "Issued after payment confirmation."
        : "Order is not active for dispatch waybill.";
  } else if (!order.marketplaceStoreOrderBridge) {
    const readiness = await getCourierPaymentReadiness(order.id, prisma);
    const paidOrCod =
      readiness.dispatchEligible ||
      ["PAID", "DEPOSIT_PAID_CASH_DUE", "CASH_DUE_ON_DELIVERY", "CASH_COLLECTED", "CASH_RECONCILED"].includes(
        readiness.status,
      );
    if (!paidOrCod) {
      waybillEligible = false;
      waybillReason = "Issued once payment or deposit verification clears.";
    }
  }

  const podEligible = Boolean(
    order && POD_ALLOWED_STATUSES.has(order.status) && order.proofOfDelivery,
  );
  const podReason = !order
    ? "Order unavailable."
    : podEligible
      ? null
      : "Issued after verified recipient OTP or administrative delivery confirmation.";

  return {
    hasActiveCompanyProfile: Boolean(company),
    waybill: {
      eligible: waybillEligible,
      issued: Boolean(waybillDoc),
      documentRef: waybillDoc?.documentRef ?? null,
      revision: waybillDoc?.revision ?? null,
      issuedAtIso: waybillDoc?.issuedAt.toISOString() ?? null,
      reasonUnavailable: waybillDoc ? null : waybillReason,
    },
    pod: {
      eligible: podEligible,
      issued: Boolean(podDoc),
      documentRef: podDoc?.documentRef ?? null,
      revision: podDoc?.revision ?? null,
      issuedAtIso: podDoc?.issuedAt.toISOString() ?? null,
      proofMethod: order?.proofOfDelivery?.method ?? null,
      reasonUnavailable: podDoc ? null : podReason,
    },
  };
}
