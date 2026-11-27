import { z } from "zod";
import { DriverOperationCommandSchema } from "@/lib/validation/pickup";

export const DriverLocationSampleSchema = DriverOperationCommandSchema.extend({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  clientCapturedAt: z.string().datetime({ offset: true }),
  accuracyMeters: z.number().finite().min(0).max(10_000).optional(),
  headingDegrees: z.number().finite().min(0).max(360).optional(),
  speedMetersPerSecond: z.number().finite().min(0).max(100).optional(),
  source: z.enum(["DEVICE_GPS", "DRIVER_MANUAL"]),
}).strict();

export type DriverLocationSampleInput = z.infer<typeof DriverLocationSampleSchema>;

export const QaSimulatedLocationCommandSchema = DriverOperationCommandSchema.extend({
  mode: z.literal("QA_SIMULATED"),
}).strict();

export type QaSimulatedLocationCommandInput = z.infer<typeof QaSimulatedLocationCommandSchema>;

export const DriverLocationRouteBodySchema = z.union([
  DriverLocationSampleSchema,
  QaSimulatedLocationCommandSchema,
]);
