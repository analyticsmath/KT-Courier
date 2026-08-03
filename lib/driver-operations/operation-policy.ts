import { OrderAssignmentStatus, OrderStatus } from "@/types/db";
import type { DriverOperationActions, OperationalAssignmentSnapshot } from "./types";

const terminal = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
]);

export function getDriverOperationActions(snapshot: OperationalAssignmentSnapshot): DriverOperationActions {
  const blockedReasons: string[] = [];
  const isCurrent = snapshot.currentDriverProfileId === snapshot.driverProfileId;
  const accepted = snapshot.assignmentStatus === OrderAssignmentStatus.ACCEPTED;
  const terminalOrder = terminal.has(snapshot.orderStatus);

  if (!snapshot.driverActive) blockedReasons.push("DRIVER_INACTIVE");
  if (!accepted) blockedReasons.push("ASSIGNMENT_NOT_ACCEPTED");
  if (!isCurrent) blockedReasons.push("ASSIGNMENT_NOT_CURRENT");
  if (terminalOrder) blockedReasons.push("ORDER_TERMINAL");

  const authorized = blockedReasons.length === 0;
  return {
    canAcceptOffer: snapshot.assignmentStatus === OrderAssignmentStatus.ASSIGNED && !terminalOrder,
    canRejectOffer: snapshot.assignmentStatus === OrderAssignmentStatus.ASSIGNED && !terminalOrder,
    canConfirmPickup: authorized && (snapshot.orderStatus === OrderStatus.CONFIRMED || snapshot.orderStatus === OrderStatus.PICKUP_SCHEDULED),
    canStartTransit: authorized && (snapshot.orderStatus === OrderStatus.PICKED_UP || snapshot.orderStatus === OrderStatus.DELIVERY_ATTEMPTED),
    canRequestDeliveryOtp: authorized && (snapshot.orderStatus === OrderStatus.IN_TRANSIT || snapshot.orderStatus === OrderStatus.DELIVERY_ATTEMPTED),
    canRecordDeliveryAttempt: authorized && (snapshot.orderStatus === OrderStatus.PICKED_UP || snapshot.orderStatus === OrderStatus.IN_TRANSIT || snapshot.orderStatus === OrderStatus.DELIVERY_ATTEMPTED),
    canCompleteDelivery: authorized && (snapshot.orderStatus === OrderStatus.IN_TRANSIT || snapshot.orderStatus === OrderStatus.DELIVERY_ATTEMPTED),
    canRetryDelivery: authorized && snapshot.orderStatus === OrderStatus.DELIVERY_ATTEMPTED,
    blockedReasons,
  };
}
