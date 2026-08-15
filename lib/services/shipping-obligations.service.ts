/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { phase5Reference, safeOperationalText } from "@/lib/operations/phase5-repository";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";

export class ShippingObligationError extends Error {
  constructor(readonly code: string) { super(code); }
}

const PREPARATION_EVENTS = new Set(["PACKAGING_CONFIRMED", "LAWFUL_LISTING_CONFIRMED", "HANDOFF_READY"]);
const DRIVER_REPORTS = new Set(["SAFETY_CHECK", "LAWFUL_TRANSPORT_CONFIRMATION", "SUSPICIOUS_PACKAGE"]);

function decimal(value: string | undefined) { return value === undefined ? null : new Prisma.Decimal(value); }
function isUniqueConstraint(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"; }

export function assertPackageDeclarationCompliesWithPolicy(policy: Record<string, any>, input: { classification: string | null; fragile?: boolean; highValue?: boolean; packagingConfirmed: boolean; declaredValue?: string; insuranceRequested?: boolean }) {
  const prohibited = Array.isArray(policy.prohibitedClassifications) ? policy.prohibitedClassifications : [];
  if (input.classification && prohibited.includes(input.classification)) throw new ShippingObligationError("PACKAGE_CLASSIFICATION_PROHIBITED");
  if ((policy.fragileHandlingRequired && input.fragile && !input.packagingConfirmed) || (!input.packagingConfirmed && policy.acceptanceRequired)) throw new ShippingObligationError("PACKAGE_PACKAGING_CONFIRMATION_REQUIRED");
  const declaredValue = decimal(input.declaredValue);
  if (declaredValue?.lt(0) || (policy.highValueDeclarationRequired && input.highValue && !declaredValue)) throw new ShippingObligationError("PACKAGE_DECLARED_VALUE_REQUIRED");
  if (policy.declaredValueMinimum && (!declaredValue || declaredValue.lt(policy.declaredValueMinimum))) throw new ShippingObligationError("PACKAGE_DECLARED_VALUE_BELOW_POLICY");
  if (policy.declaredValueMaximum && declaredValue && declaredValue.gt(policy.declaredValueMaximum)) throw new ShippingObligationError("PACKAGE_DECLARED_VALUE_ABOVE_POLICY");
  if (input.insuranceRequested && policy.insuranceMode === "UNAVAILABLE") throw new ShippingObligationError("PACKAGE_INSURANCE_UNAVAILABLE");
  return declaredValue;
}

export async function listEffectivePackagePolicies() {
  const now = new Date();
  return (prisma as any).shippingPackagePolicyVersion.findMany({
    where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
    select: { stableKey: true, versionNumber: true, prohibitedClassifications: true, fragileHandlingRequired: true, highValueDeclarationRequired: true, declaredValueMinimum: true, declaredValueMaximum: true, insuranceMode: true, insuranceCoverageLimit: true, packagingRequirements: true, effectiveFrom: true },
    orderBy: [{ stableKey: "asc" }, { versionNumber: "desc" }],
  });
}

export async function createPackagePolicyVersion(input: {
  actorUserId: string; stableKey: string; versionNumber: number; effectiveFrom: Date; effectiveTo?: Date;
  prohibitedClassifications?: string[]; fragileHandlingRequired?: boolean; highValueDeclarationRequired?: boolean;
  declaredValueMinimum?: string; declaredValueMaximum?: string; insuranceMode: "AVAILABLE" | "UNAVAILABLE" | "CLIENT_VALUE_REQUIRED";
  insuranceCoverageLimit?: string; packagingRequirements?: Record<string, unknown>;
}) {
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(input.stableKey) || input.versionNumber < 1) throw new ShippingObligationError("PACKAGE_POLICY_INVALID");
  if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom) throw new ShippingObligationError("PACKAGE_POLICY_EFFECTIVE_RANGE_INVALID");
  const min = decimal(input.declaredValueMinimum); const max = decimal(input.declaredValueMaximum);
  if (min?.lt(0) || max?.lt(0) || (min && max && min.gt(max))) throw new ShippingObligationError("PACKAGE_POLICY_VALUE_RANGE_INVALID");
  const created = await (prisma as any).shippingPackagePolicyVersion.create({ data: {
    stableKey: input.stableKey, versionNumber: input.versionNumber, status: "DRAFT", effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, createdByUserId: input.actorUserId,
    prohibitedClassifications: input.prohibitedClassifications ?? [], fragileHandlingRequired: input.fragileHandlingRequired ?? false,
    highValueDeclarationRequired: input.highValueDeclarationRequired ?? false, declaredValueMinimum: min, declaredValueMaximum: max,
    insuranceMode: input.insuranceMode, insuranceCoverageLimit: decimal(input.insuranceCoverageLimit), packagingRequirements: input.packagingRequirements ?? {},
  } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "CREATE" as any, entityType: "ShippingPackagePolicyVersion", entityId: created.id, message: "Created draft shipping package policy version", metadata: { stableKey: created.stableKey, versionNumber: created.versionNumber } });
  return created;
}

export async function activatePackagePolicyVersion(input: { actorUserId: string; stableKey: string; versionNumber: number }) {
  const client = prisma as any;
  const policy = await client.shippingPackagePolicyVersion.findUnique({ where: { stableKey_versionNumber: { stableKey: input.stableKey, versionNumber: input.versionNumber } } });
  if (!policy) throw new ShippingObligationError("PACKAGE_POLICY_NOT_FOUND");
  const activated = await client.shippingPackagePolicyVersion.update({ where: { id: policy.id }, data: { status: "ACTIVE" } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE" as any, entityType: "ShippingPackagePolicyVersion", entityId: policy.id, message: "Activated shipping package policy version", metadata: { stableKey: policy.stableKey, versionNumber: policy.versionNumber } });
  return activated;
}

export async function acceptShipmentPackagePolicy(input: {
  orderId: string; actorUserId: string; policyStableKey: string; operationId: string; declaredValue?: string; currency?: string;
  classification?: string; fragile?: boolean; highValue?: boolean; packagingConfirmed: boolean; insuranceRequested?: boolean;
}) {
  const client = prisma as any;
  const replay = await client.shipmentPackagePolicyDeclaration.findUnique({ where: { operationId: input.operationId } });
  if (replay) return replay;
  const order = await client.order.findUnique({ where: { id: input.orderId }, select: { id: true, customerId: true, store: { select: { ownerUserId: true } } } });
  if (!order || (order.customerId !== input.actorUserId && order.store?.ownerUserId !== input.actorUserId)) throw new ShippingObligationError("PACKAGE_DECLARATION_FORBIDDEN");
  const now = new Date();
  const policy = await client.shippingPackagePolicyVersion.findFirst({ where: { stableKey: input.policyStableKey, status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { versionNumber: "desc" } });
  if (!policy) throw new ShippingObligationError("PACKAGE_POLICY_NOT_ACTIVE");
  const classification = input.classification ? safeOperationalText(input.classification, 80) : null;
  const declaredValue = assertPackageDeclarationCompliesWithPolicy(policy, { classification, fragile: input.fragile, highValue: input.highValue, packagingConfirmed: input.packagingConfirmed, declaredValue: input.declaredValue, insuranceRequested: input.insuranceRequested });
  try { return await client.shipmentPackagePolicyDeclaration.create({ data: {
    publicReference: phase5Reference("PKG"), orderId: input.orderId, policyVersionId: policy.id, declaredValue, currency: input.currency ? safeOperationalText(input.currency, 3).toUpperCase() : null,
    classification, fragile: Boolean(input.fragile), highValue: Boolean(input.highValue), packagingConfirmed: input.packagingConfirmed,
    insuranceRequested: Boolean(input.insuranceRequested), acceptedByUserId: input.actorUserId, operationId: input.operationId,
    policySnapshot: { stableKey: policy.stableKey, versionNumber: policy.versionNumber, insuranceMode: policy.insuranceMode, claimsEvidenceRequired: policy.claimsEvidenceRequired, acceptedAt: now.toISOString() },
  } }); } catch (error) {
    if (isUniqueConstraint(error)) {
      const concurrentReplay = await client.shipmentPackagePolicyDeclaration.findUnique({ where: { operationId: input.operationId } });
      if (concurrentReplay) return concurrentReplay;
      throw new ShippingObligationError("PACKAGE_DECLARATION_ALREADY_ACCEPTED");
    }
    throw error;
  }
}

export async function recordVendorPreparation(input: { orderId: string; actorUserId: string; eventType: "PACKAGING_CONFIRMED" | "LAWFUL_LISTING_CONFIRMED" | "HANDOFF_READY"; operationId: string; safeNote?: string; preparationDueAt?: Date }) {
  if (!PREPARATION_EVENTS.has(input.eventType)) throw new ShippingObligationError("PREPARATION_EVENT_INVALID");
  const client = prisma as any;
  const replay = await client.shipmentPreparationEvent.findUnique({ where: { operationId: input.operationId } }); if (replay) return replay;
  const order = await client.order.findUnique({ where: { id: input.orderId }, select: { id: true, store: { select: { ownerUserId: true } } } });
  if (!order?.store?.ownerUserId || order.store.ownerUserId !== input.actorUserId) throw new ShippingObligationError("PREPARATION_FORBIDDEN");
  try { return await prisma.$transaction(async (tx) => {
    const obligation = await (tx as any).shipmentPreparationObligation.upsert({ where: { orderId: input.orderId }, create: { publicReference: phase5Reference("PREP"), orderId: input.orderId, preparationDueAt: input.preparationDueAt ?? null, updatedByUserId: input.actorUserId }, update: {} });
    if (input.eventType === "HANDOFF_READY" && (!obligation.packagingConfirmedAt || !obligation.lawfulListingConfirmedAt)) throw new ShippingObligationError("PREPARATION_HANDOFF_PREREQUISITES_REQUIRED");
    const now = new Date();
    const update: Record<string, unknown> = { updatedByUserId: input.actorUserId };
    if (input.eventType === "PACKAGING_CONFIRMED") update.packagingConfirmedAt = now;
    if (input.eventType === "LAWFUL_LISTING_CONFIRMED") update.lawfulListingConfirmedAt = now;
    if (input.eventType === "HANDOFF_READY") { update.handoffReadyAt = now; update.status = "HANDOFF_READY"; }
    const updated = await (tx as any).shipmentPreparationObligation.update({ where: { id: obligation.id }, data: update });
    const event = await (tx as any).shipmentPreparationEvent.create({ data: { obligationId: obligation.id, eventType: input.eventType, actorUserId: input.actorUserId, safeNote: input.safeNote ? safeOperationalText(input.safeNote, 500) : null, operationId: input.operationId } });
    await (tx as any).orderOperationalEvent.create({ data: { orderId: input.orderId, actorUserId: input.actorUserId, actorRole: "STORE", eventType: `VENDOR_${input.eventType}`, internalNote: input.safeNote ? safeOperationalText(input.safeNote, 500) : null } });
    return { ...event, obligation: updated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) {
    if (isUniqueConstraint(error)) { const concurrentReplay = await client.shipmentPreparationEvent.findUnique({ where: { operationId: input.operationId } }); if (concurrentReplay) return concurrentReplay; }
    throw error;
  }
}

export async function recordDriverDeliveryResponsibility(input: { assignmentId: string; driverProfileId: string; driverUserId: string; assignmentVersion: number; reportType: "SAFETY_CHECK" | "LAWFUL_TRANSPORT_CONFIRMATION" | "SUSPICIOUS_PACKAGE"; operationId: string; safeNote?: string; evidenceReference?: string }) {
  if (!DRIVER_REPORTS.has(input.reportType)) throw new ShippingObligationError("DRIVER_RESPONSIBILITY_REPORT_INVALID");
  if (input.reportType === "SUSPICIOUS_PACKAGE" && !input.safeNote?.trim()) throw new ShippingObligationError("SUSPICIOUS_PACKAGE_DETAIL_REQUIRED");
  const client = prisma as any;
  const replay = await client.driverDeliveryResponsibilityReport.findUnique({ where: { operationId: input.operationId } }); if (replay) return replay;
  const authority = await assertAcceptedCurrentDriver(input.assignmentId, input.driverProfileId, input.assignmentVersion);
  if (input.evidenceReference) {
    const media = await client.privateMediaObject.findFirst({ where: { publicReference: input.evidenceReference, ownerType: "DRIVER", ownerId: input.driverProfileId, createdByUserId: input.driverUserId, status: "READY" }, select: { id: true } });
    if (!media) throw new ShippingObligationError("DRIVER_RESPONSIBILITY_EVIDENCE_FORBIDDEN");
  }
  try { return await prisma.$transaction(async (tx) => {
    const report = await (tx as any).driverDeliveryResponsibilityReport.create({ data: { publicReference: phase5Reference("DRR"), orderId: authority.orderId, assignmentId: input.assignmentId, driverProfileId: input.driverProfileId, reportType: input.reportType, safeNote: input.safeNote ? safeOperationalText(input.safeNote, 500) : null, evidenceReference: input.evidenceReference ?? null, requiresReview: input.reportType === "SUSPICIOUS_PACKAGE", operationId: input.operationId } });
    const eventType = input.reportType === "SAFETY_CHECK" ? "DRIVER_SAFETY_CONFIRMED" : input.reportType === "LAWFUL_TRANSPORT_CONFIRMATION" ? "DRIVER_LAWFUL_TRANSPORT_CONFIRMED" : "DRIVER_SUSPICIOUS_PACKAGE_REPORTED";
    await (tx as any).orderOperationalEvent.create({ data: { orderId: authority.orderId, assignmentId: input.assignmentId, driverProfileId: input.driverProfileId, actorUserId: input.driverUserId, actorRole: "DRIVER", eventType, internalNote: report.safeNote } });
    return report;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) {
    if (isUniqueConstraint(error)) { const concurrentReplay = await client.driverDeliveryResponsibilityReport.findUnique({ where: { operationId: input.operationId } }); if (concurrentReplay) return concurrentReplay; }
    throw error;
  }
}

export async function resolveSuspiciousPackageReport(input: { publicReference: string; actorUserId: string; operationId: string; safeResolution: string }) {
  const client = prisma as any;
  const report = await client.driverDeliveryResponsibilityReport.findUnique({ where: { publicReference: input.publicReference } });
  if (!report || report.reportType !== "SUSPICIOUS_PACKAGE") throw new ShippingObligationError("SUSPICIOUS_PACKAGE_REPORT_NOT_FOUND");
  if (!report.requiresReview) return report;
  const updated = await client.driverDeliveryResponsibilityReport.update({ where: { id: report.id }, data: { requiresReview: false, resolvedAt: new Date(), resolvedByUserId: input.actorUserId } });
  await client.orderOperationalEvent.create({ data: { orderId: report.orderId, assignmentId: report.assignmentId, driverProfileId: report.driverProfileId, actorUserId: input.actorUserId, actorRole: "OPERATIONS", eventType: "ADMIN_OPERATION_NOTE_ADDED", internalNote: safeOperationalText(input.safeResolution, 500), metadata: { operationId: input.operationId, suspiciousPackageReport: report.publicReference, outcome: "REVIEW_RESOLVED" } } });
  await recordAdminActivity({ actorUserId: input.actorUserId, action: "STATUS_CHANGE" as any, entityType: "DriverDeliveryResponsibilityReport", entityId: report.id, message: "Resolved suspicious package report", metadata: { reference: report.publicReference, operationId: input.operationId } });
  return updated;
}

/** Completion retains the canonical OTP/GPS/private-proof authority, but cannot
 * bypass the driver safety/lawful-transport confirmations or an open suspicious
 * package report for the active assignment. */
export async function assertDriverDeliveryResponsibilitiesInTx(tx: unknown, input: { assignmentId: string }) {
  const reports = await (tx as any).driverDeliveryResponsibilityReport.findMany({ where: { assignmentId: input.assignmentId }, select: { reportType: true, requiresReview: true } });
  const types = new Set(reports.map((report: { reportType: string }) => report.reportType));
  if (!types.has("SAFETY_CHECK") || !types.has("LAWFUL_TRANSPORT_CONFIRMATION")) throw new ShippingObligationError("DRIVER_DELIVERY_RESPONSIBILITIES_INCOMPLETE");
  if (reports.some((report: { reportType: string; requiresReview: boolean }) => report.reportType === "SUSPICIOUS_PACKAGE" && report.requiresReview)) throw new ShippingObligationError("SUSPICIOUS_PACKAGE_REQUIRES_OPERATIONS_REVIEW");
}
