import { z } from "zod";

export const CatalogListingPublishSchema = z.object({
  version: z.number().int().positive(),
  productVersion: z.number().int().positive(),
  priceVersionReference: z.string().trim().min(8).max(80),
  operationId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/),
  reasonCode: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/),
}).strict();
export type CatalogListingPublishInput = z.infer<typeof CatalogListingPublishSchema>;
