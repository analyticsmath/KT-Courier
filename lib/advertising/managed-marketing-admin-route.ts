import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ManagedMarketingRequestError, ManagedMarketingService } from "./managed-marketing.service";

export const managedMarketingService = new ManagedMarketingService();

const channelCode = z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,63}$/);
const commercialNumber = z.coerce.number().finite().min(0);

export const packageSchema = z.object({
  code: channelCode,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  channel: z.enum(["TIKTOK", "FACEBOOK", "INSTAGRAM", "GOOGLE"]),
  channelReferences: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  packageTerms: z.record(z.string(), z.unknown()).optional(),
  durationDays: z.coerce.number().int().min(0).max(3650).nullable().optional(),
  postCount: z.coerce.number().int().min(0).max(100000).optional(),
  videoCount: z.coerce.number().int().min(0).max(100000).optional(),
  storyCount: z.coerce.number().int().min(0).max(100000).optional(),
  estimatedReachMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
  priceAmount: commercialNumber,
  taxRate: commercialNumber.max(1),
  currency: z.literal("ZAR").optional(),
  effectiveAt: z.coerce.date(),
}).strict();

export const channelCreateSchema = z.object({
  code: channelCode,
  displayName: z.string().trim().min(1).max(160),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  manualExecutionSupported: z.boolean().optional(),
  automatedProviderCapability: z.enum(["MANUAL_AVAILABLE", "AUTOMATED_PUBLISHING_SUPPORTED"]).optional(),
  providerConfigurationState: z.enum(["NOT_CONFIGURED", "CONFIGURED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const channelUpdateSchema = channelCreateSchema.omit({ code: true });

const placementTargetFields = {
  kind: z.enum(["ON_PLATFORM", "MANUAL_EXTERNAL"]),
  advertisingPlacementReference: z.string().trim().min(1).max(120).nullable().optional(),
  externalPlacementReference: z.string().trim().min(1).max(500).nullable().optional(),
};

function validatePlacementTarget(value: { kind: "ON_PLATFORM" | "MANUAL_EXTERNAL"; advertisingPlacementReference?: string | null; externalPlacementReference?: string | null }, context: z.RefinementCtx) {
  const onPlatform = value.kind === "ON_PLATFORM";
  if (onPlatform !== Boolean(value.advertisingPlacementReference) || onPlatform === Boolean(value.externalPlacementReference)) context.addIssue({ code: z.ZodIssueCode.custom, message: "Placement target does not match its kind." });
}

export const placementCreateSchema = z.object({
  ...placementTargetFields,
  code: channelCode,
  displayName: z.string().trim().min(1).max(160),
  channelReference: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict().superRefine(validatePlacementTarget);

export const placementUpdateSchema = z.object({
  ...placementTargetFields,
  displayName: z.string().trim().min(1).max(160),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict().superRefine(validatePlacementTarget);

const operationReference = z.string().trim().min(1).max(160);
export const reviewActionSchema = z.object({ operationId: operationReference, note: z.string().trim().max(4000).nullable().optional() }).strict();
export const rejectActionSchema = z.object({ operationId: operationReference, reason: z.string().trim().min(1).max(4000) }).strict();
export const manualRunActionSchema = z.object({ operationId: operationReference, externalReference: z.string().trim().min(1).max(500), actualStartedAt: z.coerce.date().optional(), note: z.string().trim().max(4000).nullable().optional() }).strict();
export const performanceSchema = z.object({ operationId: operationReference, periodStartsAt: z.coerce.date(), periodEndsAt: z.coerce.date(), impressions: z.coerce.number().int().min(0).max(2_000_000_000), clicks: z.coerce.number().int().min(0).max(2_000_000_000), conversions: z.coerce.number().int().min(0).max(2_000_000_000), externalReference: z.string().trim().min(1).max(500), note: z.string().trim().max(4000).nullable().optional() }).strict();
export const revenueReportQuerySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), storeId: z.string().trim().min(1).max(120).optional() }).strict().superRefine((value, context) => { if (value.from && value.to && value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid report date range." }); });
export const reviewListSchema = z.object({ status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "SCHEDULED", "RUNNING", "PAUSED", "ENDED", "COMPLETED", "CANCELLED"]).optional() }).strict();

export async function managedMarketingAdmin(request: NextRequest, permission: string, mutate = false) {
  if (mutate) {
    const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname });
    if (originFailure) return { response: originFailure } as const;
  }
  return requireAdminApiPermission(permission, { request });
}

export async function parseBody<T extends z.ZodTypeAny>(request: NextRequest, schema: T): Promise<z.infer<T> | NextResponse> {
  try { return schema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "Invalid managed marketing configuration." }, { status: 422 }); }
}

export function isRouteResponse(value: unknown): value is NextResponse { return value instanceof NextResponse; }

export function managedMarketingError(error: unknown) {
  const code = error instanceof ManagedMarketingRequestError ? error.code : error instanceof Error ? error.message : "MANAGED_MARKETING_CONFIGURATION_INVALID";
  const status = /(?:FORBIDDEN|NOT_ALLOWED)$/.test(code) ? 403 : /NOT_FOUND$/.test(code) ? 404 : /(?:LOCKED|CONFLICT|ALREADY_ATTACHED)$/.test(code) ? 409 : 422;
  return NextResponse.json({ error: code }, { status });
}
