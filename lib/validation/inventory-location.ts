import { z } from "zod";

export const InventoryLocationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120).refine(value => !/[<>\u0000-\u001f]/.test(value), "Use a plain-text stock location name."),
  operationId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/),
}).strict();

export type InventoryLocationCreateInput = z.infer<typeof InventoryLocationCreateSchema>;
