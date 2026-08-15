/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON } from "@/lib/subscriptions/production-lock";
import { prisma } from "@/lib/db/prisma";

export const subscriptionNoStoreHeaders = Object.freeze({ "Cache-Control": "private, no-store, max-age=0" });
export function subscriptionJson(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: subscriptionNoStoreHeaders }); }

export async function requireSubscriptionCustomer(request: NextRequest) {
  void request;
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return { response: subscriptionJson({ error: "Membership access requires an authenticated customer." }, 401), user: null } as const;
  return { response: null, user } as const;
}

/** Exact store ownership is always sufficient; delegated billing additionally needs the exact permission and respects DENY. */
export async function requireSubscriptionStoreActor(request: NextRequest, storeId: string, permission = "store_subscriptions.read") {
  const user = await getCurrentUser();
  if (!user) return { response: subscriptionJson({ error: "Store membership access requires authentication." }, 401), user: null } as const;
  const database = prisma as any;
  const [store, override, authority] = await Promise.all([
    database.store.findUnique({ where: { id: storeId }, select: { ownerUserId: true } }),
    database.userPermission.findFirst({ where: { userId: user.id, permission: { key: permission } }, select: { effect: true } }),
    database.subscriptionStoreBillingAuthority.findFirst({ where: { storeId, userId: user.id, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const allowed = Boolean(store && override?.effect !== "DENY" && (store.ownerUserId === user.id || authority));
  return allowed ? { response: null, user } as const : { response: subscriptionJson({ error: "Store membership is not available to this actor." }, 404), user: null } as const;
}

export async function requireSubscriptionStoreReference(request: NextRequest, reference: string, permission = "store_subscriptions.read") {
  const contract = await (prisma as any).subscriptionContract.findUnique({ where: { publicReference: reference }, select: { storeId: true } });
  if (!contract?.storeId) return { response: subscriptionJson({ error: "Store membership was not found." }, 404), user: null } as const;
  return requireSubscriptionStoreActor(request, contract.storeId, permission);
}

export async function enforceSubscriptionMutation(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request, { path: request.nextUrl.pathname });
  if (origin) return origin;
  const result = await checkIpRateLimit(request, "subscriptions:mutation", RATE_LIMITS.MARKETPLACE_CHECKOUT_MUTATION);
  return result.ok ? null : subscriptionJson({ error: "Too many membership requests. Please wait and try again." }, 429);
}

export async function readSubscriptionJson(request: NextRequest, limit = 4096): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership request.");
  const raw = await request.text();
  if (raw.length < 2 || Buffer.byteLength(raw, "utf8") > limit) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership request.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership request.");
  return value as Record<string, unknown>;
}

export function exactSubscriptionKeys(input: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(input).some((key) => !keys.includes(key))) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership request.");
}
export function requiredSubscriptionString(input: Record<string, unknown>, key: string, maximum = 256): string {
  const value = input[key]; if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership request."); return value.trim();
}
export function requiredSubscriptionOperationId(input: Record<string, unknown>, key = "operationId"): string {
  const operationId = requiredSubscriptionString(input, key, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(operationId)) throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Invalid membership operation ID.");
  return operationId;
}
export function subscriptionApiError(error: unknown) {
  if (error instanceof SubscriptionError) {
    const status = error.code === SUBSCRIPTIONS_PRODUCTION_BLOCK_REASON ? 503 : error.code.includes("ACCESS") ? 404 : error.code.includes("CONFLICT") || error.code.includes("STALE") ? 409 : error.code.includes("RECONCILIATION") ? 409 : 422;
    return subscriptionJson({ error: error.message, code: error.code }, status);
  }
  return subscriptionJson({ error: "Membership service is temporarily unavailable." }, 503);
}
