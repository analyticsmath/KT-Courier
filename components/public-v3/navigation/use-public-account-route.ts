"use client";

import { useEffect, useState } from "react";

/** The public site and the parcel/customer dashboard share the same host-only
 * session. Read its role through the anonymous-safe, first-party session projection instead of
 * pretending an authenticated person needs to sign in again.
 */
export function publicAccountRoute(role: unknown): string {
  switch (role) {
    case "CUSTOMER": return "/account";
    case "STORE": return "/store";
    case "DRIVER": return "/driver";
    case "ADMIN":
    case "SUPER_ADMIN": return "/admin";
    case "PROMOTER": return "/promoter";
    default: return "/login";
  }
}

export function usePublicAccountRoute(): string {
  const [href, setHref] = useState("/login");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/public/account-navigation", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const session = response.ok ? await response.json() as { role?: unknown } : null;
        if (active) setHref(publicAccountRoute(session?.role));
      } catch {
        if (active) setHref("/login");
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("kt-auth-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("kt-auth-changed", refresh);
    };
  }, []);

  return href;
}
