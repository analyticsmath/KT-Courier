import { randomUUID } from "node:crypto";
import { DeveloperApiError } from "./contracts";

export type PublicProblem = Readonly<{ type: string; title: string; status: number; detail: string; instance: string; code: string; requestId: string; retryAfter?: number; documentation?: string; errors?: Record<string, string> }>;
export function requestId(request?: Request): string { return request?.headers.get("x-client-request-id")?.slice(0, 120) || randomUUID(); }
export function problemResponse(input: { requestId: string; code: string; status: number; detail?: string; instance?: string; retryAfter?: number; errors?: Record<string, string> }): Response {
  const title = input.status === 401 ? "Authentication failed" : input.status === 403 ? "Access denied" : input.status === 404 ? "Resource not found" : input.status === 409 ? "Request conflict" : input.status === 429 ? "Request rate limited" : input.status >= 500 ? "Service unavailable" : "Request rejected";
  const body: PublicProblem = { type: `https://developers.ktcouriers.example/problems/${input.code.toLowerCase()}`, title, status: input.status, detail: input.detail ?? "The request could not be completed.", instance: input.instance ?? "", code: input.code, requestId: input.requestId, ...(input.retryAfter ? { retryAfter: input.retryAfter } : {}), ...(input.errors ? { errors: input.errors } : {}), documentation: "/developers/documentation" };
  return new Response(JSON.stringify(body), { status: input.status, headers: { "content-type": "application/problem+json", "x-request-id": input.requestId, ...(input.retryAfter ? { "retry-after": String(input.retryAfter) } : {}) } });
}
export function responseFromError(error: unknown, requestIdValue: string, instance = ""): Response {
  if (error instanceof DeveloperApiError) return problemResponse({ requestId: requestIdValue, code: error.code, status: error.status, detail: error.message, instance });
  return problemResponse({ requestId: requestIdValue, code: "PUBLIC_API_REQUEST_FAILED", status: 500, instance });
}
export function publicJson(data: unknown, requestIdValue: string, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "x-request-id": requestIdValue, ...headers } });
}
