import { NextResponse, type NextRequest } from "next/server";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";

// ─── CSRF / Origin protection ──────────────────────────────────────────────────
// Strategy: Origin/Referer header validation for state-mutating endpoints.
//
// Why this is sufficient for Phase 1:
// 1. Session cookie uses SameSite=Lax — browsers will NOT send it on cross-site
//    POST/DELETE/PATCH requests, defeating the attack before Origin is even checked.
// 2. All mutations accept only JSON (Content-Type: application/json). Browsers
//    send Origin on cross-origin fetch()s. Non-browser callers (mobile apps,
//    server-to-server) don't carry session cookies and are unaffected.
// 3. Origin check provides defence-in-depth against subdomain takeover and
//    environments where SameSite is not enforced (older proxies, some SSR setups).
//
// Limitations / Phase 2 hardening items:
// - In-memory check only — no CSRF token rotation.
// - Sub-domain cookies (e.g., app.ktcouriers.co.za → ktcouriers.co.za) are not
//   protected by SameSite=Lax; full CSP + CSRF token is recommended when a CDN
//   subdomain or embedded widget is introduced.
// - Programmatic API clients (mobile app, integrations) must send the correct
//   Origin or use an Authorization header instead of cookie auth.

function addOrigin(origins: string[], value: string | undefined): void {
  if (!value) return;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    const origin = parsed.origin;
    if (!origins.includes(origin)) origins.push(origin);
  } catch {
    // Malformed origin config is ignored here; config diagnostics live elsewhere.
  }
}

function getAllowedOrigins(request?: Request): string[] {
  const origins: string[] = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3200",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3200",
  ];

  addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL);
  addOrigin(origins, process.env.APP_URL);
  addOrigin(origins, process.env.VERCEL_URL);

  if (request) {
    addOrigin(origins, request.url);
  }

  return origins;
}

export interface OriginCheckResult {
  ok: boolean;
  status: number;
  message: string;
}

const ORIGIN_FAILURE_MESSAGE = "Invalid request origin";

function okResult(): OriginCheckResult {
  return { ok: true, status: 200, message: "OK" };
}

function failedResult(): OriginCheckResult {
  return { ok: false, status: 403, message: ORIGIN_FAILURE_MESSAGE };
}

export function validateSameOriginRequest(request: Request): OriginCheckResult {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // No Origin and no Referer: typically a server-to-server or curl request.
  // These are NOT browsers and therefore don't carry SameSite cookies from
  // cross-site contexts. Allow through — session auth will still reject
  // unauthenticated callers.
  if (!origin && !referer) {
    return okResult();
  }

  const allowed = getAllowedOrigins(request);

  if (origin) {
    if (allowed.includes(origin)) return okResult();
    return failedResult();
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return okResult();
      return failedResult();
    } catch {
      return failedResult();
    }
  }

  return okResult();
}

export function createOriginFailureResponse(result: OriginCheckResult): NextResponse {
  return NextResponse.json(
    { error: ORIGIN_FAILURE_MESSAGE },
    { status: result.status }
  );
}

export async function enforceSameOriginRequest(
  request: Request,
  options?: { path?: string }
): Promise<NextResponse | null> {
  const result = validateSameOriginRequest(request);
  if (result.ok) return null;

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.ORIGIN_CHECK_FAILED,
    severity: "MEDIUM",
    message: "Rejected mutating request due to invalid origin",
    request,
    metadata: { path: options?.path ?? request.url },
  });

  return createOriginFailureResponse(result);
}

export function checkRequestOrigin(req: NextRequest): OriginCheckResult {
  return validateSameOriginRequest(req);
}
