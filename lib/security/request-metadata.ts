import { isIP } from "node:net";

function normalizeIpCandidate(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  return isIP(candidate) ? candidate : null;
}

export function getRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded
      .split(",")
      .map((part) => part.trim())
      .map(normalizeIpCandidate)
      .find((part): part is string => Boolean(part));
    if (firstIp) return firstIp;
  }

  const realIp = normalizeIpCandidate(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const cfConnectingIp = normalizeIpCandidate(request.headers.get("cf-connecting-ip"));
  if (cfConnectingIp) return cfConnectingIp;

  return null;
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
