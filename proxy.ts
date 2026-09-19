import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "kt_session";
export const HOST_SESSION_COOKIE_NAME = "__Host-kt_session";

const RAILWAY_PRODUCTION_ORIGIN = "https://web-production-9f8bb.up.railway.app";

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

  // Vercel deployment is intentionally used as the public edge while the
  // production runtime and stateful dependencies live on Railway.
  // The Vercel project currently has no production DATABASE_URL by design,
  // so proxy every request to the healthy Railway runtime instead of invoking
  // database-backed Vercel functions with incomplete configuration.
  if (process.env.VERCEL && !process.env.DATABASE_URL?.trim()) {
    const upstream = new URL(pathname + request.nextUrl.search, RAILWAY_PRODUCTION_ORIGIN);
    return NextResponse.rewrite(upstream);
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
