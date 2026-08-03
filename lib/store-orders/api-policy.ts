import { NextResponse, type NextRequest } from "next/server";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { StoreOrderError } from "@/lib/store-orders/errors";
import { STORE_ORDER_PRODUCTION_BLOCK_REASON } from "@/lib/store-orders/production-lock";

export const storeOrderNoStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };
export const storeOrderJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: storeOrderNoStoreHeaders });

export async function enforceStoreOrderMutation(request: NextRequest, type: "store" | "customer" | "handoff" | "admin") {
  const origin = await enforceSameOriginRequest(request, { path: request.nextUrl.pathname });
  if (origin) return origin;
  const policy = type === "handoff" ? RATE_LIMITS.STORE_ORDER_HANDOFF : type === "customer" ? RATE_LIMITS.STORE_ORDER_CUSTOMER_MUTATION : type === "admin" ? RATE_LIMITS.STORE_ORDER_ADMIN_RECOVERY : RATE_LIMITS.STORE_ORDER_MUTATION;
  return checkIpRateLimit(request, `store-order:${type}`, policy).ok ? null : storeOrderJson({ error: "Too many store-order requests. Please wait and try again." }, 429);
}

export async function storeOrderBody(request: NextRequest, limit = 4096): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body.");
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") < 2 || Buffer.byteLength(raw, "utf8") > limit) throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body.");
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body.");
  return value as Record<string, unknown>;
}

export function exactKeys(body: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(body).some((key) => !keys.includes(key))) throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body.");
}
export function text(body: Record<string, unknown>, key: string, min = 1, max = 200): string {
  const value = body[key]; if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body."); return value.trim();
}
export function integer(body: Record<string, unknown>, key: string): number {
  const value = body[key]; if (!Number.isSafeInteger(value)) throw new StoreOrderError("STORE_ORDER_INPUT_INVALID", "Invalid request body."); return value as number;
}
export function storeOrderError(error: unknown) {
  if ((error as { code?: string })?.code === STORE_ORDER_PRODUCTION_BLOCK_REASON) return storeOrderJson({ error: "Store-order operations await consolidated validation.", code: STORE_ORDER_PRODUCTION_BLOCK_REASON }, 503);
  if (error instanceof StoreOrderError) {
    const status = error.code.includes("ACCESS") || error.code.includes("NOT_FOUND") ? 404 : error.code.includes("CONFLICT") ? 409 : error.code.includes("LOCKED") ? 503 : 422;
    return storeOrderJson({ error: error.message, code: error.code }, status);
  }
  return storeOrderJson({ error: "The store-order operation could not be completed." }, 503);
}
