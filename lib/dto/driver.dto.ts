import {
  User,
  DriverProfile,
  DriverServiceRegion,
  DeliveryRegion,
  DriverDocument,
  DriverStatus,
  DriverAvailability,
  DriverOnboardingStatus,
  VehicleType,
  DocumentType,
  DocumentStatus,
} from "@/types/db";
import { toUserPublicDto, type UserPublicDto } from "./user.dto";

// Driver service region details
export interface DriverRegionDto {
  regionId: string;
  name: string;
  slug: string;
  isPrimary: boolean;
}

// Driver Document summary
export interface DriverDocumentDto {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  fileName: string | null;
  expiresAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
}

// ─── DTO for Driver List in Admin ───────────────────────────────────────────
export interface DriverSummaryDto {
  id: string;
  driverCode: string;
  displayName: string | null;
  phone: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  availabilityRevision: number;
  onboardingStatus: DriverOnboardingStatus;
  vehicleType: VehicleType | null;
  createdAt: Date;
  updatedAt: Date;
  user: UserPublicDto;
  primaryRegion: DriverRegionDto | null;
}

// ─── DTO for Driver Details in Admin (includes emergency contact, documents, notes) ──
export interface DriverDetailDto extends DriverSummaryDto {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleRegistration: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: Date | null;
  serviceNotes: string | null;
  internalNotes: string | null;
  approvedAt: Date | null;
  approvedByAdminId: string | null;
  rejectedAt: Date | null;
  rejectedByAdminId: string | null;
  rejectionReason: string | null;
  suspendedAt: Date | null;
  suspendedByAdminId: string | null;
  suspensionReason: string | null;
  serviceRegions: DriverRegionDto[];
  documents: DriverDocumentDto[];
}

// ─── DTO for Driver Self Portal (no internalNotes, no admin review info unless relevant) ─
export interface DriverSelfDto {
  id: string;
  driverCode: string;
  displayName: string | null;
  phone: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  availabilityRevision: number;
  onboardingStatus: DriverOnboardingStatus;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vehicleType: VehicleType | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehicleRegistration: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: Date | null;
  serviceNotes: string | null;
  serviceRegions: DriverRegionDto[];
  user: UserPublicDto;
}

// ─── Mapper Functions ────────────────────────────────────────────────────────

export function toDriverRegionDto(
  dsr: DriverServiceRegion & { deliveryRegion: DeliveryRegion }
): DriverRegionDto {
  return {
    regionId: dsr.deliveryRegionId,
    name: dsr.deliveryRegion.name,
    slug: dsr.deliveryRegion.slug,
    isPrimary: dsr.isPrimary,
  };
}

export function toDriverDocumentDto(doc: DriverDocument): DriverDocumentDto {
  return {
    id: doc.id,
    documentType: doc.documentType,
    status: doc.status,
    fileName: doc.fileName,
    expiresAt: doc.expiresAt,
    reviewedAt: doc.reviewedAt,
    rejectionReason: doc.rejectionReason,
  };
}

export function toDriverSummaryDto(
  driver: DriverProfile & {
    user: User;
    serviceRegions: (DriverServiceRegion & { deliveryRegion: DeliveryRegion })[];
  }
): DriverSummaryDto {
  const regions = driver.serviceRegions.map(toDriverRegionDto);
  const primary = regions.find((r) => r.isPrimary) ?? regions[0] ?? null;

  return {
    id: driver.id,
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    phone: driver.phone,
    status: driver.status,
    availability: driver.availability,
    availabilityRevision: (driver as DriverProfile & { availabilityRevision?: number }).availabilityRevision ?? 1,
    onboardingStatus: driver.onboardingStatus,
    vehicleType: driver.vehicleType,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
    user: toUserPublicDto(driver.user),
    primaryRegion: primary,
  };
}

export function toDriverDetailDto(
  driver: DriverProfile & {
    user: User;
    serviceRegions: (DriverServiceRegion & { deliveryRegion: DeliveryRegion })[];
    documents: DriverDocument[];
  }
): DriverDetailDto {
  const summary = toDriverSummaryDto(driver);
  return {
    ...summary,
    emergencyContactName: driver.emergencyContactName,
    emergencyContactPhone: driver.emergencyContactPhone,
    vehicleMake: driver.vehicleMake,
    vehicleModel: driver.vehicleModel,
    vehicleColor: driver.vehicleColor,
    vehicleRegistration: driver.vehicleRegistration,
    licenseNumber: driver.licenseNumber,
    licenseExpiryDate: driver.licenseExpiryDate,
    serviceNotes: driver.serviceNotes,
    internalNotes: driver.internalNotes,
    approvedAt: driver.approvedAt,
    approvedByAdminId: driver.approvedByAdminId,
    rejectedAt: driver.rejectedAt,
    rejectedByAdminId: driver.rejectedByAdminId,
    rejectionReason: driver.rejectionReason,
    suspendedAt: driver.suspendedAt,
    suspendedByAdminId: driver.suspendedByAdminId,
    suspensionReason: driver.suspensionReason,
    serviceRegions: driver.serviceRegions.map(toDriverRegionDto),
    documents: driver.documents.map(toDriverDocumentDto),
  };
}

export function toDriverSelfDto(
  driver: DriverProfile & {
    user: User;
    serviceRegions: (DriverServiceRegion & { deliveryRegion: DeliveryRegion })[];
  }
): DriverSelfDto {
  return {
    id: driver.id,
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    phone: driver.phone,
    status: driver.status,
    availability: driver.availability,
    availabilityRevision: (driver as DriverProfile & { availabilityRevision?: number }).availabilityRevision ?? 1,
    onboardingStatus: driver.onboardingStatus,
    emergencyContactName: driver.emergencyContactName,
    emergencyContactPhone: driver.emergencyContactPhone,
    vehicleType: driver.vehicleType,
    vehicleMake: driver.vehicleMake,
    vehicleModel: driver.vehicleModel,
    vehicleColor: driver.vehicleColor,
    vehicleRegistration: driver.vehicleRegistration,
    licenseNumber: driver.licenseNumber,
    licenseExpiryDate: driver.licenseExpiryDate,
    serviceNotes: driver.serviceNotes,
    serviceRegions: driver.serviceRegions.map(toDriverRegionDto),
    user: toUserPublicDto(driver.user),
  };
}
