import { OrderAssignmentStatus, OrderStatus } from "@/types/db";

export const DRIVER_OPERATIONS_POLICY_VERSION = "driver-operations-v1";

export type DriverOperationType =
  | "PICKUP_START"
  | "PICKUP_CONFIRM"
  | "TRANSIT_START"
  | "DELIVERY_OTP_REQUEST"
  | "DELIVERY_OTP_REQUEST"
  | "DELIVERY_ATTEMPT"
  | "DELIVERY_RESUME"
  | "DELIVERY_COMPLETE";

export type DriverOperationActions = {
  canAcceptOffer: boolean;
  canRejectOffer: boolean;
  canConfirmPickup: boolean;
  canStartTransit: boolean;
  canRequestDeliveryOtp: boolean;
  canRecordDeliveryAttempt: boolean;
  canCompleteDelivery: boolean;
  canRetryDelivery: boolean;
  blockedReasons: string[];
};

export type OperationalAssignmentSnapshot = {
  assignmentId: string;
  assignmentVersion: number;
  assignmentStatus: OrderAssignmentStatus;
  orderId: string;
  orderStatus: OrderStatus;
  currentDriverProfileId: string | null;
  driverProfileId: string;
  driverActive: boolean;
  driverUserId: string;
};
