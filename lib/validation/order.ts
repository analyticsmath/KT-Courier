import { z } from "zod";
import { DeliveryType, OrderStatus, VehicleType } from "@/types/db";
import { AddressInputSchema } from "./address";
import { ORDER_STATUS_TRANSITIONS } from "@/lib/orders/order-state-machine";

// ─── All valid statuses ───────────────────────────────────────────────────────

export const ALL_ORDER_STATUSES = [
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PICKUP_SCHEDULED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.IN_PROGRESS,
  OrderStatus.DELIVERY_ATTEMPTED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
] as const;

// Keep legacy name as alias to avoid breaking imports
export const PHASE1_ORDER_STATUSES = ALL_ORDER_STATUSES;

// ─── Transition matrix ────────────────────────────────────────────────────────
// Defines every allowed status → status move.
// Terminal statuses map to empty arrays.

export const VALID_STATUS_TRANSITIONS: Record<string, OrderStatus[]> = ORDER_STATUS_TRANSITIONS;

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Create order ─────────────────────────────────────────────────────────────

export const CreateOrderSchema = z
  .object({
    pricingQuoteId: z.string().cuid("A valid pricing quote is required"),
    deliveryType: z.nativeEnum(DeliveryType, { error: "Delivery type is required" }),
    pickupAddress: AddressInputSchema,
    dropoffAddress: AddressInputSchema,
    recipientName: z.string().min(2, "Recipient name is required").max(150).trim(),
    recipientPhone: z.string().min(7, "Recipient phone is required").max(30).trim(),
    parcelDescription: z.string().trim().max(500).optional(),
    parcelCount: z
      .number({ error: "Parcel count must be a number" })
      .int("Parcel count must be a whole number")
      .min(1, "At least 1 parcel is required")
      .max(20, "Maximum 20 parcels per order")
      .default(1),
    scheduledFor: z.string().datetime({ message: "Scheduled date must be a valid date-time" }).optional(),
    customerNote: z.string().trim().max(1000).optional(),
    paymentMethod: z.enum(["DIGITAL_ONLY", "FULL_COD", "DEPOSIT_PLUS_COD"]).optional(),
    // Non-monetary parcel facts are revalidated against the immutable quote.
    // Prices, rates, totals, and route values remain intentionally absent.
    vehicleClass: z.nativeEnum(VehicleType).optional(),
    actualWeightKg: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    lengthCm: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    widthCm: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    heightCm: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
    // Phase 2.1 route values — for client-side preview display only.
    // These are NEVER stored directly. Server recalculates if coordinates are present.
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.deliveryType === DeliveryType.SCHEDULED && !data.scheduledFor) {
      ctx.addIssue({
        code: "custom",
        message: "Scheduled date is required for scheduled deliveries",
        path: ["scheduledFor"],
      });
    }
    if (data.scheduledFor) {
      const scheduled = new Date(data.scheduledFor);
      if (scheduled <= new Date()) {
        ctx.addIssue({
          code: "custom",
          message: "Scheduled date must be in the future",
          path: ["scheduledFor"],
        });
      }
    }
    const dimensions = [data.lengthCm, data.widthCm, data.heightCm];
    if (dimensions.some(Boolean) && !dimensions.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        message: "All three parcel dimensions are required together.",
        path: ["lengthCm"],
      });
    }
  });

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ─── Estimate (subset — no recipient required) ───────────────────────────────

export const OrderEstimateSchema = z.object({
  deliveryType: z.nativeEnum(DeliveryType, { error: "Delivery type is required" }),
  parcelCount: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(1),
});

export type OrderEstimateInput = z.infer<typeof OrderEstimateSchema>;

// ─── Admin status update ──────────────────────────────────────────────────────

export const AdminOrderStatusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus, { error: "Status is required" }).refine(
    (s) => ALL_ORDER_STATUSES.includes(s as (typeof ALL_ORDER_STATUSES)[number]),
    "Invalid status"
  ),
  note: z.string().trim().max(1000).optional(),
  internalNote: z.string().trim().max(2000).optional(),
});

export type AdminOrderStatusUpdateInput = z.infer<typeof AdminOrderStatusUpdateSchema>;

// ─── Customer/store cancel ────────────────────────────────────────────────────

export const CustomerCancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CustomerCancelOrderInput = z.infer<typeof CustomerCancelOrderSchema>;
