import type { NextConfig } from "next";

// ─── Security headers ─────────────────────────────────────────────────────────
// Applied to all routes. A full Content-Security-Policy is deferred to Phase 2
// because Next.js 16 App Router requires 'unsafe-inline' for hydration scripts,
// and a CSP that breaks hydration is worse than no CSP. The safer headers below
// are low-risk and broadly supported.
//
// Phase 2 hardening items:
// - CSP with nonce-based script-src (requires Next.js middleware nonce injection)
// - Strict-Transport-Security (HSTS) — set at the CDN/host level, not Next.js
// - Cross-Origin-Opener-Policy / Cross-Origin-Resource-Policy if iframes are used

const securityHeaders = [
  // Prevents browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Controls how much referrer info is sent with requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Prevents this page from being embedded in any frame (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Disables browser features not used by this app
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/payments/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/orders/:orderReference/payment",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
