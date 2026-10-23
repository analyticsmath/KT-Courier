import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveEdgeOrigin } from "@/lib/deployment/edge-routing";

export const SESSION_COOKIE_NAME = "kt_session";
export const HOST_SESSION_COOKIE_NAME = "__Host-kt_session";

/**
 * Public browser routes that never require authentication session cookies.
 */
export const PUBLIC_BROWSER_PATHS = [
  "/",
  "/login",
  "/signup",
  "/stores",
  "/products",
  "/coverage-areas",
  "/track",
  "/contact",
  "/terms",
  "/privacy",
];

/**
 * Protected browser root prefixes requiring an active session cookie.
 */
const PROTECTED_BROWSER_PREFIXES = [
  "/admin",
  "/store",
  "/driver",
  "/account",
  "/applicant",
];

/**
 * Validates and sanitizes a return URL to prevent open redirect vulnerabilities.
 * Returns relative path starting with / or default '/'.
 */
export function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url) return "/";
  const trimmed = url.trim();
  // Must start with single slash, not double slash, backslash, or protocol
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || /^[a-z]+:/i.test(trimmed)) {
    return "/";
  }
  return trimmed;
}

/**
 * Next.js 16 request proxy handler for coarse browser surface gating and request integrity.
 * Proxy provides coarse gating only; final business authorization is enforced at route/service layers.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (process.env.VERCEL === "1") {
    try {
      if (process.env.NODE_ENV !== "production" || process.env.KT_RUNTIME_ENV === "e2e" || process.env.KT_NETWORK_DISABLED === "true") throw new Error("Invalid edge runtime");
      if (!resolveEdgeOrigin(process.env)) throw new Error("Missing edge identity");
      // The build's beforeFiles rewrites own the origin for every path/asset.
      // Do not rewrite from mutable runtime origins or render preview pages.
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Routing is unavailable in this environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  // Static assets and internal Next.js endpoints are always bypassed
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  // API and Webhook routes handle their own protocol-specific authentication
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Legacy role-specific login aliases are not real pages. Normalize them
  // before coarse session gating so successful login returns to a real,
  // role-protected dashboard instead of /driver/login or /store/login (404).
  const loginLanding: Record<string, string> = {
    "/admin/login": "/admin",
    "/store/login": "/store",
    "/driver/login": "/driver",
    "/account/login": "/account",
    "/applicant/login": "/applicant",
  };
  const canonicalDashboard = loginLanding[pathname];
  if (canonicalDashboard) {
    const sessionCookie =
      request.cookies.get(HOST_SESSION_COOKIE_NAME)?.value ||
      request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const destination = new URL(sessionCookie ? canonicalDashboard : "/login", request.url);
    if (!sessionCookie) destination.searchParams.set("returnUrl", canonicalDashboard);
    return NextResponse.redirect(destination);
  }

  // Check if requested path belongs to a protected browser surface
  const isProtectedBrowserPath = PROTECTED_BROWSER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedBrowserPath) {
    const sessionCookie =
      request.cookies.get(HOST_SESSION_COOKIE_NAME)?.value ||
      request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      const returnUrl = sanitizeReturnUrl(pathname + request.nextUrl.search);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", returnUrl);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Security headers for response
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export default proxy;
