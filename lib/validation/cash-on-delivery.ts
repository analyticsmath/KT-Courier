import { z } from "zod";
const operationId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
export const CodCollectionSchema = z.object({ amount: money, operationId }).strict();
export const CodFailureSchema = z.object({ operationId, reasonCode: z.enum(["CUSTOMER_UNAVAILABLE", "CUSTOMER_REFUSED", "INSUFFICIENT_CASH", "AMOUNT_DISPUTE", "DELIVERY_FAILED", "OTHER"]) }).strict();
export const CodReconciliationSchema = z.object({ amount: money, operationId, evidenceReference: z.string().trim().max(160).optional() }).strict();
