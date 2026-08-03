import type {
  OrderAssignment,
  OrderAssignmentEvent,
  DriverProfile,
  DriverServiceRegion,
  DeliveryRegion,
  User,
  Order,
  Address,
} from "@/types/db";
import { OrderAssignmentStatus, OrderAssignmentEventType, DriverStatus, DriverAvailability, VehicleType } from "@/types/db";
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_EVENT_LABELS } from "@/lib/constants/assignments";

// ─── Assignment event DTO ─────────────────────────────────────────────────────

export interface AssignmentEventDto {
  id: string;
  eventType: OrderAssignmentEventType;
  eventLabel: string;
  previousStatus: OrderAssignmentStatus | null;
  newStatus: OrderAssignmentStatus | null;
  actorName: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: Date;
}

export function toAssignmentEventDto(
  event: OrderAssignmentEvent
): AssignmentEventDto {
  return {
    id: event.id,
    eventType: event.eventType,
    eventLabel: ASSIGNMENT_EVENT_LABELS[event.eventType],
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    actorName: null,
    actorRole: event.actorRole,
    note: event.note,
    createdAt: event.createdAt,
  };
}

// ─── Driver summary for dispatch (admin-facing — includes private fields) ─────
// Safe to show to admins; never serialised to customer/store responses.

export interface DispatchDriverDto {
  id: string;
  driverCode: string;
  displayName: string | null;
  phone: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  vehicleType: VehicleType | null;
  vehicleRegistration: string | null;
  serviceRegions: { regionId: string; name: string; isPrimary: boolean }[];
  userName: string | null;
  userEmail: string;
}

export function toDispatchDriverDto(
  driver: DriverProfile & {
    user: User;
    serviceRegions: (DriverServiceRegion & { deliveryRegion: DeliveryRegion })[];
  }
): DispatchDriverDto {
  return {
    id: driver.id,
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    phone: driver.phone,
    status: driver.status,
    availability: driver.availability,
    vehicleType: driver.vehicleType,
    vehicleRegistration: driver.vehicleRegistration,
    serviceRegions: driver.serviceRegions.map((sr) => ({
      regionId: sr.deliveryRegionId,
      name: sr.deliveryRegion.name,
      isPrimary: sr.isPrimary,
    })),
    userName: driver.user.name,
    userEmail: driver.user.email,
  };
}

// ─── Admin assignment detail DTO ──────────────────────────────────────────────
// Includes driver private data — admin only.

export interface AdminAssignmentDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  pickupCity: string | null;
  dropoffCity: string | null;
  deliveryRegionId: string | null;
  deliveryRegionName: string | null;
  driverProfileId: string;
  driverCode: string;
  driverDisplayName: string | null;
  driverPhone: string | null;
  vehicleType: VehicleType | null;
  vehicleRegistration: string | null;
  driverStatus: DriverStatus;
  driverAvailability: DriverAvailability;
  status: OrderAssignmentStatus;
  statusLabel: string;
  adminNote: string | null;
  driverNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  reassignedFromId: string | null;
  assignedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  events: AssignmentEventDto[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  expiresAt: Date | null;
}

export function toAdminAssignmentDto(
  assignment: OrderAssignment & {
    order: Order & {
      pickupAddress?: Address | null;
      dropoffAddress?: Address | null;
      deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
    };
    driverProfile: DriverProfile & {
      user: User;
      serviceRegions: (DriverServiceRegion & { deliveryRegion: DeliveryRegion })[];
    };
    events?: OrderAssignmentEvent[];
  }
): AdminAssignmentDto {
  return {
    id: assignment.id,
    orderId: assignment.orderId,
    orderNumber: assignment.order.orderNumber,
    orderStatus: assignment.order.status,
    pickupCity: assignment.order.pickupAddress?.city ?? null,
    dropoffCity: assignment.order.dropoffAddress?.city ?? null,
    deliveryRegionId: assignment.order.deliveryRegionId,
    deliveryRegionName: assignment.order.deliveryRegion?.name ?? null,
    driverProfileId: assignment.driverProfileId,
    driverCode: assignment.driverProfile.driverCode,
    driverDisplayName: assignment.driverProfile.displayName,
    driverPhone: assignment.driverProfile.phone,
    vehicleType: assignment.driverProfile.vehicleType,
    vehicleRegistration: assignment.driverProfile.vehicleRegistration,
    driverStatus: assignment.driverProfile.status,
    driverAvailability: assignment.driverProfile.availability,
    status: assignment.status,
    statusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status],
    adminNote: assignment.adminNote,
    driverNote: assignment.driverNote,
    rejectionReason: assignment.rejectionReason,
    cancellationReason: assignment.cancellationReason,
    reassignedFromId: assignment.reassignedFromId,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    rejectedAt: assignment.rejectedAt,
    cancelledAt: assignment.cancelledAt,
    completedAt: assignment.completedAt,
    events: (assignment.events ?? []).map(toAssignmentEventDto),
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    version: assignment.version,
    expiresAt: assignment.expiresAt,
  };
}

// ─── Driver assignment DTO ────────────────────────────────────────────────────
// Safe for driver consumption — no private admin notes, no customer PII beyond safe label.

export interface DriverAssignmentDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  pickupLine1: string | null;
  pickupCity: string | null;
  pickupProvince: string | null;
  pickupFormattedAddress: string | null;
  dropoffLine1: string | null;
  dropoffCity: string | null;
  dropoffProvince: string | null;
  dropoffFormattedAddress: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  deliveryRegionId: string | null;
  deliveryRegionName: string | null;
  status: OrderAssignmentStatus;
  statusLabel: string;
  driverNote: string | null;
  rejectionReason: string | null;
  assignedAt: Date;
  acceptedAt: Date | null;
  events: AssignmentEventDto[];
  createdAt: Date;
  version: number;
  expiresAt: Date | null;
}

export function toDriverAssignmentDto(
  assignment: OrderAssignment & {
    order: Order & {
      pickupAddress?: Address | null;
      dropoffAddress?: Address | null;
      deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
    };
    events?: OrderAssignmentEvent[];
  }
): DriverAssignmentDto {
  return {
    id: assignment.id,
    orderId: assignment.orderId,
    orderNumber: assignment.order.orderNumber,
    orderStatus: assignment.order.status,
    pickupLine1: assignment.order.pickupAddress?.line1 ?? null,
    pickupCity: assignment.order.pickupAddress?.city ?? null,
    pickupProvince: assignment.order.pickupAddress?.province ?? null,
    pickupFormattedAddress: assignment.order.pickupAddress?.formattedAddress ?? null,
    dropoffLine1: assignment.order.dropoffAddress?.line1 ?? null,
    dropoffCity: assignment.order.dropoffAddress?.city ?? null,
    dropoffProvince: assignment.order.dropoffAddress?.province ?? null,
    dropoffFormattedAddress: assignment.order.dropoffAddress?.formattedAddress ?? null,
    distanceMeters: assignment.order.distanceMeters,
    durationSeconds: assignment.order.durationSeconds,
    deliveryRegionId: assignment.order.deliveryRegionId,
    deliveryRegionName: assignment.order.deliveryRegion?.name ?? null,
    status: assignment.status,
    statusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status],
    driverNote: assignment.driverNote,
    rejectionReason: assignment.rejectionReason,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    events: (assignment.events ?? []).map(toAssignmentEventDto),
    createdAt: assignment.createdAt,
    version: assignment.version,
    expiresAt: assignment.expiresAt,
  };
}

// ─── Customer/store safe assignment state ─────────────────────────────────────
// Minimal — never exposes driver PII or admin notes.

export interface PublicAssignmentStateDto {
  hasAssignment: boolean;
  status: OrderAssignmentStatus | null;
  statusLabel: string | null;
  driverFirstName: string | null;
}

export function toPublicAssignmentStateDto(
  assignment: (OrderAssignment & { driverProfile: DriverProfile }) | null,
  showDriverName: boolean = false
): PublicAssignmentStateDto {
  if (!assignment) {
    return { hasAssignment: false, status: null, statusLabel: null, driverFirstName: null };
  }

  const firstName = showDriverName && assignment.status === OrderAssignmentStatus.ACCEPTED
    ? (assignment.driverProfile.displayName?.split(" ")[0] ?? null)
    : null;

  return {
    hasAssignment: true,
    status: assignment.status,
    statusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status],
    driverFirstName: firstName,
  };
}

// ─── Driver eligibility result ────────────────────────────────────────────────

export type EligibilityCategory =
  | "RECOMMENDED"
  | "AVAILABLE"
  | "REGION_MISMATCH"
  | "UNAVAILABLE"
  | "BUSY"
  | "NOT_ELIGIBLE";

export interface DriverEligibilityDto extends DispatchDriverDto {
  eligibility: EligibilityCategory;
  regionMatch: boolean;
  activeAssignmentCount: number;
  warnings: string[];
}
