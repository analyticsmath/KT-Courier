import { OrderStatus } from "@/types/db";

/**
 * Booking acceptance does not imply that a digitally funded delivery is paid.
 * Only the already-resolved, approved, zero-deposit full-COD policy can make a
 * new direct booking dispatch-ready without an online payment callback.
 * The caller must resolve and validate the live cash policy before this step.
 */
export function initialCourierBookingStatus(
  payment: Readonly<{ mode: string; digitalRequired: string }> | null,
): OrderStatus {
  return payment?.mode === "FULL_COD" && payment.digitalRequired === "0.00"
    ? OrderStatus.CONFIRMED
    : OrderStatus.PENDING;
}
