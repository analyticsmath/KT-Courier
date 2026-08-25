import { resolveCanonicalClientIp, type TrustedProxyMode } from "./client-ip";

export function getRequestIp(
  request: Request | { headers: Headers | { get(name: string): string | null } },
  options?: { mode?: TrustedProxyMode },
): string | null {
  return resolveCanonicalClientIp(request, options);
}

export function getRequestUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.trim() || null;
}

export function getRequestMetadata(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: getRequestIp(request),
    userAgent: getRequestUserAgent(request),
  };
}
