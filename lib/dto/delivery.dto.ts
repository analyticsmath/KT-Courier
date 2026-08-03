import type {
  ProofOfDelivery,
  OrderAssignment,
  Order,
  Address,
  DriverProfile,
  DeliveryRegion,
} from "@/types/db";
import {
  ProofOfDeliveryMethod,
  OrderStatus,
  OrderAssignmentStatus,
  DeliveryExceptionReason,
} from "@/types/db";
import { POD_METHOD_LABELS, POD_METHOD_PUBLIC_LABELS, DELIVERY_EXCEPTION_REASON_LABELS } from "@/lib/constants/delivery";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/assignments";
import { toDriverOperationalEventDto, type DriverOperationalEventDto } from "@/lib/dto/pickup.dto";

// ─── Admin Proof of Delivery DTO ──────────────────────────────────────────────
// Full admin view — includes internalNote, driverCode, method label.

export interface AdminPodDto {
  id: string;
  orderId: string;
  assignmentId: string | null;
  driverCode: string | null;
  driverDisplayName: string | null;
  method: ProofOfDeliveryMethod;
  methodLabel: string;
  recipientName: string;
  recipientPhone: string | null;
  otpVerifiedAt: Date | null;
  deliveredAt: Date;
  publicNote: string | null;
  internalNote: string | null;
  hasLocation: boolean;
  createdByRole: string;
  createdAt: Date;
}

type PodWithRelations = ProofOfDelivery & {
  driverProfile?: Pick<DriverProfile, "driverCode" | "displayName"> | null;
};

export function toAdminPodDto(pod: PodWithRelations): AdminPodDto {
  return {
    id: pod.id,
    orderId: pod.orderId,
    assignmentId: pod.assignmentId,
    driverCode: pod.driverProfile?.driverCode ?? null,
    driverDisplayName: pod.driverProfile?.displayName ?? null,
    method: pod.method,
    methodLabel: POD_METHOD_LABELS[pod.method],
    recipientName: pod.recipientName,
    recipientPhone: pod.recipientPhone,
    otpVerifiedAt: pod.otpVerifiedAt,
    deliveredAt: pod.deliveredAt,
    publicNote: pod.publicNote,
    internalNote: pod.internalNote,
    hasLocation: pod.latitude !== null && pod.longitude !== null,
    createdByRole: pod.createdByRole,
    createdAt: pod.createdAt,
  };
}

// ─── Customer/store safe POD DTO ──────────────────────────────────────────────
// NO internalNote, NO driver PII, NO exact location.

export interface PublicPodDto {
  orderId: string;
  methodLabel: string;
  recipientName: string;
  deliveredAt: Date;
  publicNote: string | null;
}

export function toPublicPodDto(pod: PodWithRelations): PublicPodDto {
  return {
    orderId: pod.orderId,
    methodLabel: POD_METHOD_PUBLIC_LABELS[pod.method],
    recipientName: pod.recipientName,
    deliveredAt: pod.deliveredAt,
    publicNote: pod.publicNote,
  };
}

// ─── Driver delivery workbench DTO ────────────────────────────────────────────

export interface DeliveryAssignmentDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  pickupLine1: string | null;
  pickupCity: string | null;
  dropoffLine1: string | null;
  dropoffCity: string | null;
  dropoffProvince: string | null;
  dropoffFormattedAddress: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  dropoffContactName: string | null;
  dropoffContactPhone: string | null;
  dropoffAccessNotes: string | null;
  parcelDescription: string | null;
  parcelCount: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  deliveryRegionName: string | null;
  assignmentStatus: OrderAssignmentStatus;
  assignmentStatusLabel: string;
  acceptedAt: Date | null;
  deliveryStarted: boolean;
  deliveryCompleted: boolean;
  deliveryAttempted: boolean;
  operationalEvents: DriverOperationalEventDto[];
}

type DeliveryAssignmentSource = OrderAssignment & {
  order: Order & {
    pickupAddress?: Address | null;
    dropoffAddress?: Address | null;
    deliveryRegion?: Pick<DeliveryRegion, "name"> | null;
  };
  operationalEvents?: (Parameters<typeof toDriverOperationalEventDto>[0])[];
};

export function toDeliveryAssignmentDto(
  assignment: DeliveryAssignmentSource
): DeliveryAssignmentDto {
  const events = (assignment.operationalEvents ?? []).map(toDriverOperationalEventDto);
  const deliveryStarted = events.some(
    (e) => e.eventType === "DELIVERY_STARTED" || e.eventType === "DELIVERY_OTP_GENERATED"
  );
  const deliveryCompleted = events.some((e) => e.eventType === "DELIVERY_COMPLETED");
  const deliveryAttempted = events.some((e) => e.eventType === "DELIVERY_ATTEMPTED");

  return {
    id: assignment.id,
    orderId: assignment.orderId,
    orderNumber: assignment.order.orderNumber,
    orderStatus: assignment.order.status,
    pickupLine1: assignment.order.pickupAddress?.line1 ?? null,
    pickupCity: assignment.order.pickupAddress?.city ?? null,
    dropoffLine1: assignment.order.dropoffAddress?.line1 ?? null,
    dropoffCity: assignment.order.dropoffAddress?.city ?? null,
    dropoffProvince: assignment.order.dropoffAddress?.province ?? null,
    dropoffFormattedAddress: assignment.order.dropoffAddress?.formattedAddress ?? null,
    recipientName: assignment.order.recipientName,
    recipientPhone: assignment.order.recipientPhone,
    dropoffContactName: assignment.order.dropoffAddress?.contactName ?? null,
    dropoffContactPhone: assignment.order.dropoffAddress?.contactPhone ?? null,
    dropoffAccessNotes: assignment.order.dropoffAddress?.accessNotes ?? null,
    parcelDescription: assignment.order.parcelDescription,
    parcelCount: assignment.order.parcelCount,
    distanceMeters: assignment.order.distanceMeters,
    durationSeconds: assignment.order.durationSeconds,
    deliveryRegionName: assignment.order.deliveryRegion?.name ?? null,
    assignmentStatus: assignment.status,
    assignmentStatusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status],
    acceptedAt: assignment.acceptedAt,
    deliveryStarted,
    deliveryCompleted,
    deliveryAttempted,
    operationalEvents: events,
  };
}

// ─── Admin delivery exception DTO ─────────────────────────────────────────────

export interface AdminDeliveryExceptionDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  assignmentId: string | null;
  driverCode: string | null;
  driverDisplayName: string | null;
  deliveryRegionName: string | null;
  exceptionReason: DeliveryExceptionReason | null;
  exceptionReasonLabel: string | null;
  eventType: string;
  note: string | null;
  occurredAt: Date;
}

export function toAdminDeliveryExceptionDto(
  event: {
    id: string;
    orderId: string;
    assignmentId: string | null;
    eventType: string;
    deliveryExceptionReason: DeliveryExceptionReason | null;
    publicNote: string | null;
    internalNote: string | null;
    occurredAt: Date;
    driverProfile?: Pick<DriverProfile, "driverCode" | "displayName"> | null;
    order: { orderNumber: string; status: OrderStatus; deliveryRegion?: { name: string } | null };
  }
): AdminDeliveryExceptionDto {
  return {
    id: event.id,
    orderId: event.orderId,
    orderNumber: event.order.orderNumber,
    orderStatus: event.order.status,
    assignmentId: event.assignmentId,
    driverCode: event.driverProfile?.driverCode ?? null,
    driverDisplayName: event.driverProfile?.displayName ?? null,
    deliveryRegionName: event.order.deliveryRegion?.name ?? null,
    exceptionReason: event.deliveryExceptionReason,
    exceptionReasonLabel: event.deliveryExceptionReason
      ? DELIVERY_EXCEPTION_REASON_LABELS[event.deliveryExceptionReason]
      : null,
    eventType: event.eventType,
    note: event.publicNote ?? event.internalNote ?? null,
    occurredAt: event.occurredAt,
  };
}

// ─── Delivery summary for driver dashboard ───────────────────────────────────

export interface DeliveryWorkbenchSummary {
  deliveryReadyCount: number;
  inTransitCount: number;
  deliveryAttemptedCount: number;
}
