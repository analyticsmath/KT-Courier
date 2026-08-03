import type {
  OrderOperationalEvent,
  OrderAssignment,
  DriverProfile,
  Order,
  Address,
  DeliveryRegion,
} from "@/types/db";
import {
  OrderOperationalEventType,
  PickupFailureReason,
  ParcelCondition,
  OrderStatus,
  OrderAssignmentStatus,
  DeliveryExceptionReason,
} from "@/types/db";
import {
  OPERATIONAL_EVENT_LABELS,
  CUSTOMER_OPERATIONAL_EVENT_LABELS,
  PICKUP_FAILURE_REASON_LABELS,
  PARCEL_CONDITION_LABELS,
} from "@/lib/constants/pickup";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/assignments";

// ─── Admin operational event DTO ──────────────────────────────────────────────
// Full detail — admin only. Never serialise this to customer/store responses.

export interface AdminOperationalEventDto {
  id: string;
  orderId: string;
  assignmentId: string | null;
  driverProfileId: string | null;
  driverCode: string | null;
  driverDisplayName: string | null;
  actorUserId: string;
  actorRole: string;
  eventType: OrderOperationalEventType;
  eventLabel: string;
  statusBefore: OrderStatus | null;
  statusAfter: OrderStatus | null;
  occurredAt: Date;
  publicNote: string | null;
  internalNote: string | null;
  failureReason: PickupFailureReason | null;
  failureReasonLabel: string | null;
  parcelCondition: ParcelCondition | null;
  parcelConditionLabel: string | null;
  parcelCount: number | null;
  deliveryExceptionReason: DeliveryExceptionReason | null;
  hasLocation: boolean;
  createdAt: Date;
}

type OperationalEventWithRelations = OrderOperationalEvent & {
  driverProfile?: Pick<DriverProfile, "driverCode" | "displayName"> | null;
};

export function toAdminOperationalEventDto(
  event: OperationalEventWithRelations
): AdminOperationalEventDto {
  return {
    id: event.id,
    orderId: event.orderId,
    assignmentId: event.assignmentId,
    driverProfileId: event.driverProfileId,
    driverCode: event.driverProfile?.driverCode ?? null,
    driverDisplayName: event.driverProfile?.displayName ?? null,
    actorUserId: event.actorUserId,
    actorRole: event.actorRole,
    eventType: event.eventType,
    eventLabel: OPERATIONAL_EVENT_LABELS[event.eventType],
    statusBefore: event.statusBefore,
    statusAfter: event.statusAfter,
    occurredAt: event.occurredAt,
    publicNote: event.publicNote,
    internalNote: event.internalNote,
    failureReason: event.failureReason,
    failureReasonLabel: event.failureReason ? PICKUP_FAILURE_REASON_LABELS[event.failureReason] : null,
    parcelCondition: event.parcelCondition,
    parcelConditionLabel: event.parcelCondition ? PARCEL_CONDITION_LABELS[event.parcelCondition] : null,
    parcelCount: event.parcelCount,
    deliveryExceptionReason: event.deliveryExceptionReason ?? null,
    hasLocation: event.latitude !== null && event.longitude !== null,
    createdAt: event.createdAt,
  };
}

// ─── Driver operational event DTO ─────────────────────────────────────────────
// Driver sees only their own events. No internalNote.

export interface DriverOperationalEventDto {
  id: string;
  orderId: string;
  eventType: OrderOperationalEventType;
  eventLabel: string;
  statusBefore: OrderStatus | null;
  statusAfter: OrderStatus | null;
  occurredAt: Date;
  publicNote: string | null;
  parcelCondition: ParcelCondition | null;
  parcelConditionLabel: string | null;
  parcelCount: number | null;
  failureReason: PickupFailureReason | null;
  failureReasonLabel: string | null;
  hasLocation: boolean;
}

export function toDriverOperationalEventDto(
  event: OperationalEventWithRelations
): DriverOperationalEventDto {
  return {
    id: event.id,
    orderId: event.orderId,
    eventType: event.eventType,
    eventLabel: OPERATIONAL_EVENT_LABELS[event.eventType],
    statusBefore: event.statusBefore,
    statusAfter: event.statusAfter,
    occurredAt: event.occurredAt,
    publicNote: event.publicNote,
    parcelCondition: event.parcelCondition,
    parcelConditionLabel: event.parcelCondition ? PARCEL_CONDITION_LABELS[event.parcelCondition] : null,
    parcelCount: event.parcelCount,
    failureReason: event.failureReason,
    failureReasonLabel: event.failureReason ? PICKUP_FAILURE_REASON_LABELS[event.failureReason] : null,
    hasLocation: event.latitude !== null && event.longitude !== null,
  };
}

// ─── Customer/store safe pickup event DTO ─────────────────────────────────────
// ONLY publicNote and safe event label. No internal data, no driver PII.

export interface PublicPickupEventDto {
  id: string;
  eventType: OrderOperationalEventType;
  eventLabel: string;
  publicNote: string | null;
  occurredAt: Date;
}

export function toPublicPickupEventDto(
  event: OperationalEventWithRelations
): PublicPickupEventDto {
  return {
    id: event.id,
    eventType: event.eventType,
    eventLabel: CUSTOMER_OPERATIONAL_EVENT_LABELS[event.eventType],
    publicNote: event.publicNote,
    occurredAt: event.occurredAt,
  };
}

// ─── Driver workbench assignment DTO ──────────────────────────────────────────
// Extends driver assignment info with pickup-specific context.

export interface WorkbenchAssignmentDto {
  id: string;
  version: number;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  pickupLine1: string | null;
  pickupCity: string | null;
  pickupProvince: string | null;
  pickupFormattedAddress: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  pickupAccessNotes: string | null;
  dropoffLine1: string | null;
  dropoffCity: string | null;
  dropoffProvince: string | null;
  dropoffFormattedAddress: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  parcelDescription: string | null;
  parcelCount: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  deliveryRegionName: string | null;
  assignmentStatus: OrderAssignmentStatus;
  assignmentStatusLabel: string;
  acceptedAt: Date | null;
  assignedAt: Date;
  pickupStarted: boolean;
  pickupCompleted: boolean;
  operationalEvents: DriverOperationalEventDto[];
}

type WorkbenchAssignmentSource = OrderAssignment & {
  order: Order & {
    pickupAddress?: Address | null;
    dropoffAddress?: Address | null;
    deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
  };
  operationalEvents?: (OperationalEventWithRelations)[];
};

export function toWorkbenchAssignmentDto(
  assignment: WorkbenchAssignmentSource
): WorkbenchAssignmentDto {
  const events = (assignment.operationalEvents ?? []).map(toDriverOperationalEventDto);
  const pickupStarted = events.some((e) => e.eventType === OrderOperationalEventType.PICKUP_STARTED);
  const pickupCompleted = events.some((e) => e.eventType === OrderOperationalEventType.PICKUP_COMPLETED);

  return {
    id: assignment.id,
    version: assignment.version,
    orderId: assignment.orderId,
    orderNumber: assignment.order.orderNumber,
    orderStatus: assignment.order.status,
    pickupLine1: assignment.order.pickupAddress?.line1 ?? null,
    pickupCity: assignment.order.pickupAddress?.city ?? null,
    pickupProvince: assignment.order.pickupAddress?.province ?? null,
    pickupFormattedAddress: assignment.order.pickupAddress?.formattedAddress ?? null,
    pickupContactName: assignment.order.pickupAddress?.contactName ?? null,
    pickupContactPhone: assignment.order.pickupAddress?.contactPhone ?? null,
    pickupAccessNotes: assignment.order.pickupAddress?.accessNotes ?? null,
    dropoffLine1: assignment.order.dropoffAddress?.line1 ?? null,
    dropoffCity: assignment.order.dropoffAddress?.city ?? null,
    dropoffProvince: assignment.order.dropoffAddress?.province ?? null,
    dropoffFormattedAddress: assignment.order.dropoffAddress?.formattedAddress ?? null,
    recipientName: assignment.order.recipientName,
    recipientPhone: assignment.order.recipientPhone,
    parcelDescription: assignment.order.parcelDescription,
    parcelCount: assignment.order.parcelCount,
    distanceMeters: assignment.order.distanceMeters,
    durationSeconds: assignment.order.durationSeconds,
    deliveryRegionName: assignment.order.deliveryRegion?.name ?? null,
    assignmentStatus: assignment.status,
    assignmentStatusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status],
    acceptedAt: assignment.acceptedAt,
    assignedAt: assignment.assignedAt,
    pickupStarted,
    pickupCompleted,
    operationalEvents: events,
  };
}

// ─── Admin pickup exception DTO ───────────────────────────────────────────────

export interface AdminPickupExceptionDto {
  id: string;
  orderId: string;
  orderNumber: string;
  assignmentId: string | null;
  driverCode: string | null;
  driverDisplayName: string | null;
  deliveryRegionName: string | null;
  failureReason: PickupFailureReason | null;
  failureReasonLabel: string | null;
  note: string | null;
  occurredAt: Date;
}

export function toAdminPickupExceptionDto(
  event: OperationalEventWithRelations & {
    order: Order & { deliveryRegion?: Pick<DeliveryRegion, "name"> | null };
  }
): AdminPickupExceptionDto {
  return {
    id: event.id,
    orderId: event.orderId,
    orderNumber: (event as unknown as { order: { orderNumber: string } }).order.orderNumber,
    assignmentId: event.assignmentId,
    driverCode: event.driverProfile?.driverCode ?? null,
    driverDisplayName: event.driverProfile?.displayName ?? null,
    deliveryRegionName: (event as unknown as { order: { deliveryRegion?: { name: string } | null } }).order.deliveryRegion?.name ?? null,
    failureReason: event.failureReason,
    failureReasonLabel: event.failureReason ? PICKUP_FAILURE_REASON_LABELS[event.failureReason] : null,
    note: event.publicNote ?? event.internalNote ?? null,
    occurredAt: event.occurredAt,
  };
}
