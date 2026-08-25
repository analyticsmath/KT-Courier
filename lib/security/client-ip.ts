import { isIP } from "node:net";

export type TrustedProxyMode = "direct" | "single_trusted_proxy" | "cloudflare";

export interface ClientIpResolutionOptions {
  mode?: TrustedProxyMode;
}

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle IPv4 with port, e.g. "192.0.2.1:8080"
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(trimmed)) {
    const ipPart = trimmed.split(":")[0];
    return isIP(ipPart) === 4 ? ipPart : null;
  }

  // Handle IPv6 enclosed in brackets with port, e.g. "[2001:db8::1]:8080"
  if (/^\[([a-fA-F0-9:]+)\](:\d+)?$/.test(trimmed)) {
    const match = trimmed.match(/^\[([a-fA-F0-9:]+)\]/);
    if (match && isIP(match[1]) === 6) return match[1];
  }

  return isIP(trimmed) ? trimmed : null;
}

export function getTrustedProxyMode(): TrustedProxyMode {
  const configured = process.env.TRUSTED_PROXY_MODE?.trim().toLowerCase();
  if (configured === "single_trusted_proxy" || configured === "trusted_proxy" || configured === "reverse_proxy") {
    return "single_trusted_proxy";
  }
  if (configured === "cloudflare") {
    return "cloudflare";
  }
  return "direct";
}

/**
 * Authoritative client IP resolver for security boundaries, rate limiting, and audit logging.
 *
 * Prevents client-controlled spoofing by strictly enforcing the configured proxy trust model:
 * - "direct": Direct client connection. Forwarded headers are ignored because the peer can forge them.
 * - "single_trusted_proxy": Trusted reverse proxy / load balancer terminates traffic. The immediate
 *   client IP is the last entry in X-Forwarded-For (or X-Real-IP if unchained).
 * - "cloudflare": Traffic passes through Cloudflare. CF-Connecting-IP is trusted.
 */
export function resolveCanonicalClientIp(
  request: Request | { headers: Headers | { get(name: string): string | null } },
  options?: ClientIpResolutionOptions,
): string | null {
  const mode = options?.mode ?? getTrustedProxyMode();
  const headers = request.headers;

  if (mode === "direct") {
    // In direct mode, we do NOT trust client-supplied forwarded headers as they can be easily forged.
    return null;
  }

  if (mode === "cloudflare") {
    const cfIp = normalizeIp(headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;
    const realIp = normalizeIp(headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  if (mode === "single_trusted_proxy") {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      // In a single trusted reverse proxy model, the trusted proxy appends the client IP to the end.
      // The leftmost entries may be forged by the client, so we take the rightmost valid IP.
      const entries = forwarded
        .split(",")
        .map((part) => normalizeIp(part.trim()))
        .filter((part): part is string => Boolean(part));

      if (entries.length > 0) {
        return entries[entries.length - 1];
      }
    }

    const realIp = normalizeIp(headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  return null;
}
