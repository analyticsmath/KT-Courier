import { z } from "zod";
const measurement = z.number().finite().positive().max(1000).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00000001, "Use at most four decimal places.");
export const CatalogPackagingSchema = z.object({
  lengthCm: measurement, widthCm: measurement, heightCm: measurement,
  weightKg: z.number().finite().positive().max(10000).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00000001, "Use at most four decimal places."),
  description: z.string().trim().min(10).max(500),
}).strict();
export type CatalogPackaging = z.infer<typeof CatalogPackagingSchema>;
