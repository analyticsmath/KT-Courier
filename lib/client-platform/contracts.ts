import { z } from "zod";
export class PlatformError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}
export const PROVINCES = [
  "Gauteng",
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "Free State",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
] as const;
export const SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((v) => Number(v) <= 1000000);
const tariff = z
  .object({
    baseFee: money,
    perKmRate: money,
    maximumWeightKg: z.number().positive().max(10000).nullable(),
    minimumCharge: money.nullable(),
  })
  .strict();
export const DeliveryConfigurationSchema = z
  .object({
    stableKey: z.string().regex(/^CLIENT_[A-Z0-9_]{2,40}$/),
    displayName: z.string().trim().min(2).max(80),
    active: z.boolean(),
    turnaround: z.string().trim().min(2).max(150),
    provinces: z.array(z.enum(PROVINCES)).min(1).max(9),
    regionIds: z.array(z.string().cuid()).max(100),
    tariffs: z
      .object({ SMALL: tariff, MEDIUM: tariff, LARGE: tariff })
      .strict(),
    expectedVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.active &&
      v.stableKey === "CLIENT_EXPRESS" &&
      SIZES.some((s) => Number(v.tariffs[s].baseFee) <= 0)
    )
      c.addIssue({
        code: "custom",
        path: ["tariffs"],
        message: "Express requires a confirmed fee for every parcel size.",
      });
    if (v.active)
      for (const s of SIZES)
        if (
          Number(v.tariffs[s].baseFee) +
            Number(v.tariffs[s].perKmRate) +
            Number(v.tariffs[s].minimumCharge ?? 0) <=
          0
        )
          c.addIssue({
            code: "custom",
            message:
              "An active service needs a positive tariff for every parcel size.",
            path: ["tariffs", s],
          });
  });
export type DeliveryConfiguration = z.infer<typeof DeliveryConfigurationSchema>;
export const QuoteAddressSchema = z
  .object({
    line1: z.string().trim().min(5).max(250),
    city: z.string().trim().min(2).max(100),
    province: z.enum(PROVINCES),
    postalCode: z.string().trim().max(10).optional(),
  })
  .strict();
export const PublicQuoteSchema = z
  .object({
    serviceKey: z.string().regex(/^CLIENT_[A-Z0-9_]{2,40}$/),
    parcelSize: z.enum(SIZES),
    weightKg: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/)
      .refine((v) => Number(v) > 0 && Number(v) <= 10000),
    pickupAddress: QuoteAddressSchema,
    dropoffAddress: QuoteAddressSchema,
  })
  .strict();
export type PublicQuoteInput = z.infer<typeof PublicQuoteSchema>;
export const QuoteBookingSchema = z
  .object({
    pickupContactName: z.string().trim().min(2).max(150),
    pickupContactPhone: z.string().trim().min(7).max(30),
    recipientName: z.string().trim().min(2).max(150),
    recipientPhone: z.string().trim().min(7).max(30),
    parcelDescription: z.string().trim().max(500).optional(),
    scheduledFor: z.iso
      .datetime()
      .refine(
        (v) => new Date(v) > new Date(),
        "Choose a future collection time.",
      )
      .optional(),
  })
  .strict();
