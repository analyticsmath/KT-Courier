import { z, type ZodType } from "zod";
import { CreateOrderSchema, CustomerCancelOrderSchema } from "@/lib/validation/order";
import { PricingQuoteRequestSchema } from "@/lib/validation/pricing";
import { WEBHOOK_EVENT_CATALOG, DeveloperApiError } from "./contracts";

const boundedText = (maximum: number, minimum = 1) => z.string().trim().min(minimum).max(maximum);
const opaqueReference = z.string().trim().min(8).max(180).regex(/^(?:KT-\d{4}-[A-Z0-9]+|[a-z][a-z0-9]*_[A-Za-z0-9_-]{6,})$/, "Invalid public reference.");
const emptyObject = z.object({}).strict();

export const PublicQuoteRequestSchema = PricingQuoteRequestSchema.strict();
export const PublicOrderRequestSchema = CreateOrderSchema.strict();
export const PublicOrderCancelRequestSchema = CustomerCancelOrderSchema.strict();
export const PublicStoreOrderAcceptRequestSchema = z.object({ preparationMinutes: z.number().int().min(1).max(720), pickupInstructions: boundedText(500) }).strict();
export const PublicStoreOrderRejectRequestSchema = z.object({ reasonCode: boundedText(80).regex(/^[A-Z0-9_]+$/), note: boundedText(500).optional() }).strict();
export const PublicStoreOrderReadyRequestSchema = z.object({ packageEvidence: z.object({ packageCount: z.number().int().min(1).max(100), sealed: z.boolean().optional() }).strict().optional() }).strict();
export const PublicWebhookCreateRequestSchema = z.object({ endpoint: z.string().url().max(2048), eventTypes: z.array(z.enum(Object.keys(WEBHOOK_EVENT_CATALOG) as [keyof typeof WEBHOOK_EVENT_CATALOG, ...(keyof typeof WEBHOOK_EVENT_CATALOG)[]])).min(1).max(20) }).strict();
export const PublicWebhookPatchRequestSchema = z.object({ endpoint: z.string().url().max(2048).optional(), eventTypes: z.array(z.enum(Object.keys(WEBHOOK_EVENT_CATALOG) as [keyof typeof WEBHOOK_EVENT_CATALOG, ...(keyof typeof WEBHOOK_EVENT_CATALOG)[]])).min(1).max(20).optional() }).strict().refine((value) => Boolean(value.endpoint || value.eventTypes), "At least one webhook field is required.");
export const PublicWebhookVerifyRequestSchema = emptyObject;
export const PublicWebhookRotateSecretRequestSchema = emptyObject;
export const PublicWebhookRetryRequestSchema = emptyObject;

export function assertPublicReference(value: string): string { const parsed = opaqueReference.safeParse(value); if (!parsed.success) throw new DeveloperApiError("PUBLIC_API_REFERENCE_INVALID", 400, "The resource reference is invalid."); return parsed.data; }
function depth(value: unknown, current = 0): number { if (!value || typeof value !== "object") return current; if (Array.isArray(value)) return value.reduce((maximum: number, item: unknown) => Math.max(maximum, depth(item, current + 1)), current + 1); return Object.values(value as Record<string, unknown>).reduce((maximum: number, item: unknown) => Math.max(maximum, depth(item, current + 1)), current + 1); }
export function validatePublicBody<T>(schema: ZodType<T>, value: unknown): T { if (depth(value) > 6) throw new DeveloperApiError("PUBLIC_API_BODY_TOO_COMPLEX", 400, "The request body is too deeply nested."); const result = schema.safeParse(value); if (!result.success) throw new DeveloperApiError("PUBLIC_API_VALIDATION_FAILED", 400, "The request body is invalid."); return result.data; }
