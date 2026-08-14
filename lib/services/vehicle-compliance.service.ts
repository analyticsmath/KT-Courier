import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import { DocumentStatus, PrivateMediaOwnerType, PrivateMediaPurpose, VehicleComplianceStatus, VehicleDocumentType, VehicleMediaPurpose, VehicleType } from "@/types/db";

export class VehicleComplianceError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 403 | 404 | 409 | 422, message: string) {
    super(message);
    this.name = "VehicleComplianceError";
  }
}

export type CreateVehicleInput = Readonly<{ make: string; model: string; year?: number | null; colour?: string | null; registrationNumber: string; vehicleType: VehicleType; capacityKg?: string | null }>;

function normalizedRegistration(input: string): string {
  const value = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{2,20}$/.test(value)) throw new VehicleComplianceError("VEHICLE_REGISTRATION_INVALID", 422, "Vehicle registration is invalid.");
  return value;
}

function futureExpiry(value: Date | null | undefined): Date | null {
  if (!value) return null;
  if (Number.isNaN(value.valueOf())) throw new VehicleComplianceError("VEHICLE_DOCUMENT_EXPIRY_INVALID", 422, "Document expiry is invalid.");
  return value;
}

function documentPurpose(type: VehicleDocumentType): PrivateMediaPurpose {
  if (type === VehicleDocumentType.REGISTRATION) return PrivateMediaPurpose.VEHICLE_REGISTRATION;
  if (type === VehicleDocumentType.LICENCE_DISC) return PrivateMediaPurpose.VEHICLE_LICENCE_DISC;
  if (type === VehicleDocumentType.INSURANCE) return PrivateMediaPurpose.VEHICLE_INSURANCE;
  return PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE;
}

export async function createOwnVehicle(driverUserId: string, input: CreateVehicleInput) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId: driverUserId }, select: { id: true } });
  if (!driver) throw new VehicleComplianceError("DRIVER_PROFILE_NOT_FOUND", 404, "Driver profile was not found.");
  const registrationNumber = normalizedRegistration(input.registrationNumber);
  const existing = await prisma.vehicle.findFirst({ where: { registrationNumber, archivedAt: null } });
  if (existing) throw new VehicleComplianceError("VEHICLE_REGISTRATION_CONFLICT", 409, "A current vehicle already uses this registration number.");
  try {
    return await prisma.vehicle.create({
      data: {
        publicReference: `VEH-${randomUUID()}`,
        driverProfileId: driver.id,
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year ?? null,
        colour: input.colour?.trim() || null,
        registrationNumber,
        vehicleType: input.vehicleType,
        capacityKg: input.capacityKg ?? null,
      },
      select: { id: true, publicReference: true, registrationNumber: true, vehicleType: true, status: true, createdAt: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") throw new VehicleComplianceError("VEHICLE_REGISTRATION_CONFLICT", 409, "A current vehicle already uses this registration number.");
    throw error;
  }
}

export async function listOwnVehicles(driverUserId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId: driverUserId }, select: { id: true } });
  if (!driver) throw new VehicleComplianceError("DRIVER_PROFILE_NOT_FOUND", 404, "Driver profile was not found.");
  return prisma.vehicle.findMany({
    where: { driverProfileId: driver.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicReference: true, make: true, model: true, year: true, colour: true, registrationNumber: true, vehicleType: true, capacityKg: true, status: true, createdAt: true, documents: { select: { documentType: true, status: true, expiresAt: true } }, media: { select: { purpose: true } } },
  });
}

export async function attachOwnVehicleDocument(input: Readonly<{ driverUserId: string; vehicleId: string; documentType: VehicleDocumentType; privateMediaReference: string; expiresAt?: Date | null }>) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, driverProfile: { userId: input.driverUserId }, archivedAt: null }, select: { id: true } });
  if (!vehicle) throw new VehicleComplianceError("VEHICLE_NOT_FOUND", 404, "Vehicle was not found.");
  const media = await prisma.privateMediaObject.findUnique({ where: { publicReference: input.privateMediaReference } });
  if (!media || media.ownerType !== PrivateMediaOwnerType.VEHICLE || media.ownerId !== vehicle.id || media.status !== "READY" || media.purpose !== documentPurpose(input.documentType)) throw new VehicleComplianceError("VEHICLE_DOCUMENT_MEDIA_INVALID", 422, "The uploaded private media cannot be used for this vehicle document.");
  const expiresAt = futureExpiry(input.expiresAt);
  return prisma.$transaction(async (tx) => {
    const prior = await tx.vehicleDocument.findFirst({ where: { vehicleId: vehicle.id, documentType: input.documentType, status: { in: [DocumentStatus.PENDING, DocumentStatus.SUBMITTED, DocumentStatus.APPROVED] } } });
    if (prior) await tx.vehicleDocument.update({ where: { id: prior.id }, data: { status: DocumentStatus.REJECTED, rejectionReason: "SUPERSEDED_BY_NEW_UPLOAD" } });
    return tx.vehicleDocument.create({ data: { vehicleId: vehicle.id, documentType: input.documentType, privateMediaObjectId: media.id, expiresAt, status: DocumentStatus.SUBMITTED } });
  });
}

export async function attachOwnVehicleMedia(input: Readonly<{ driverUserId: string; vehicleId: string; purpose: VehicleMediaPurpose; privateMediaReference: string }>) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, driverProfile: { userId: input.driverUserId }, archivedAt: null }, select: { id: true } });
  if (!vehicle) throw new VehicleComplianceError("VEHICLE_NOT_FOUND", 404, "Vehicle was not found.");
  const media = await prisma.privateMediaObject.findUnique({ where: { publicReference: input.privateMediaReference } });
  if (!media || media.ownerType !== PrivateMediaOwnerType.VEHICLE || media.ownerId !== vehicle.id || media.status !== "READY" || media.purpose !== PrivateMediaPurpose.VEHICLE_COMPLIANCE_IMAGE) throw new VehicleComplianceError("VEHICLE_MEDIA_INVALID", 422, "The uploaded private media cannot be used for this vehicle image.");
  return prisma.vehicleMedia.upsert({ where: { vehicleId_purpose: { vehicleId: vehicle.id, purpose: input.purpose } }, update: { privateMediaObjectId: media.id }, create: { vehicleId: vehicle.id, purpose: input.purpose, privateMediaObjectId: media.id } });
}

export async function reviewVehicle(input: Readonly<{ adminUserId: string; vehicleId: string; status: Extract<VehicleComplianceStatus, "APPROVED" | "REJECTED" | "SUSPENDED" | "ARCHIVED">; reason?: string }>) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId }, include: { documents: true } });
  if (!vehicle) throw new VehicleComplianceError("VEHICLE_NOT_FOUND", 404, "Vehicle was not found.");
  if ((input.status === "REJECTED" || input.status === "SUSPENDED") && !input.reason?.trim()) throw new VehicleComplianceError("VEHICLE_REVIEW_REASON_REQUIRED", 422, "A reason is required for rejection or suspension.");
  if (input.status === "APPROVED") {
    const required = [VehicleDocumentType.REGISTRATION, VehicleDocumentType.LICENCE_DISC, VehicleDocumentType.INSURANCE];
    const now = new Date();
    const missing = required.some((type) => !vehicle.documents.some((document) => document.documentType === type && document.status === DocumentStatus.APPROVED && (!document.expiresAt || document.expiresAt > now)));
    if (missing) throw new VehicleComplianceError("VEHICLE_COMPLIANCE_INCOMPLETE", 409, "Vehicle cannot be approved until its required valid documents are approved.");
  }
  const data = input.status === "APPROVED" ? { status: input.status, approvedAt: new Date(), approvedByUserId: input.adminUserId, rejectedAt: null, rejectedByUserId: null, rejectionReason: null, version: { increment: 1 } } : input.status === "REJECTED" ? { status: input.status, rejectedAt: new Date(), rejectedByUserId: input.adminUserId, rejectionReason: input.reason!.trim(), version: { increment: 1 } } : input.status === "SUSPENDED" ? { status: input.status, suspendedAt: new Date(), suspendedByUserId: input.adminUserId, suspensionReason: input.reason!.trim(), version: { increment: 1 } } : { status: input.status, archivedAt: new Date(), version: { increment: 1 } };
  const updated = await prisma.vehicle.update({ where: { id: vehicle.id }, data });
  await recordAdminActivity({ actorUserId: input.adminUserId, action: "STATUS_CHANGE", entityType: "Vehicle", entityId: vehicle.id, message: `Vehicle ${vehicle.publicReference} transitioned to ${input.status}.`, metadata: { vehicleReference: vehicle.publicReference, status: input.status, reason: input.reason ?? null } });
  return updated;
}

export async function reviewVehicleDocument(input: Readonly<{ adminUserId: string; vehicleDocumentId: string; status: Extract<DocumentStatus, "APPROVED" | "REJECTED">; reason?: string }>) {
  const document = await prisma.vehicleDocument.findUnique({ where: { id: input.vehicleDocumentId }, include: { vehicle: true } });
  if (!document) throw new VehicleComplianceError("VEHICLE_DOCUMENT_NOT_FOUND", 404, "Vehicle document was not found.");
  if (input.status === DocumentStatus.REJECTED && !input.reason?.trim()) throw new VehicleComplianceError("VEHICLE_DOCUMENT_REJECTION_REASON_REQUIRED", 422, "A reason is required when rejecting a vehicle document.");
  const updated = await prisma.vehicleDocument.update({ where: { id: document.id }, data: { status: input.status, reviewedAt: new Date(), reviewedByUserId: input.adminUserId, rejectionReason: input.status === DocumentStatus.REJECTED ? input.reason!.trim() : null } });
  await recordAdminActivity({ actorUserId: input.adminUserId, action: "STATUS_CHANGE", entityType: "VehicleDocument", entityId: document.id, message: `Vehicle document ${document.documentType} reviewed as ${input.status}.`, metadata: { vehicleReference: document.vehicle.publicReference, status: input.status } });
  return updated;
}

export type DispatchComplianceResult = Readonly<{ eligible: boolean; reasons: readonly string[]; approvedVehicleId: string | null }>;

export function evaluateDispatchComplianceEvidence(input: Readonly<{ driverDocuments: readonly { documentType: string; status: DocumentStatus; expiresAt: Date | null }[]; vehicles: readonly { id: string; documents: readonly { documentType: VehicleDocumentType; status: DocumentStatus; expiresAt: Date | null }[] }[]; now?: Date }>): DispatchComplianceResult {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const requiredDriverDocs = ["ID_DOCUMENT", "LICENSE"] as const;
  for (const type of requiredDriverDocs) if (!input.driverDocuments.some((document) => document.documentType === type && document.status === DocumentStatus.APPROVED && (!document.expiresAt || document.expiresAt > now))) reasons.push(`DRIVER_DOCUMENT_${type}_INVALID`);
  const requiredVehicleDocs = [VehicleDocumentType.REGISTRATION, VehicleDocumentType.LICENCE_DISC, VehicleDocumentType.INSURANCE];
  const approved = input.vehicles.find((vehicle) => requiredVehicleDocs.every((type) => vehicle.documents.some((document) => document.documentType === type && document.status === DocumentStatus.APPROVED && (!document.expiresAt || document.expiresAt > now))));
  if (!approved) reasons.push("NO_COMPLIANT_APPROVED_VEHICLE");
  return { eligible: reasons.length === 0, reasons, approvedVehicleId: approved?.id ?? null };
}

export async function evaluateDriverDispatchCompliance(driverProfileId: string): Promise<DispatchComplianceResult> {
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverProfileId }, include: { documents: true, vehicles: { where: { status: VehicleComplianceStatus.APPROVED, archivedAt: null }, include: { documents: true } } } });
  if (!driver) return { eligible: false, reasons: ["DRIVER_NOT_FOUND"], approvedVehicleId: null };
  if (!driver.vehicleComplianceRequiredAt) return { eligible: true, reasons: ["LEGACY_COMPLIANCE_CUTOVER_PENDING"], approvedVehicleId: null };
  return evaluateDispatchComplianceEvidence({ driverDocuments: driver.documents, vehicles: driver.vehicles });
}
