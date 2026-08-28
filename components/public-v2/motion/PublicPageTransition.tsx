"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePublicMotionPreference } from "./usePublicMotionPreference";

interface PublicPageTransitionProps {
  children: React.ReactNode;
}

const FAST_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/accept-invitation",
  "/account-locked",
  "/session-expired",
  "/security-verification",
  "/checkout",
  "/account",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
  "/accessibility",
  "/safety",
];

export function PublicPageTransition({ children }: PublicPageTransitionProps) {
  const pathname = usePathname();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prefersReducedMotion) {
      prevPathRef.current = pathname;
      return;
    }

    const isFast = FAST_ROUTES.some((route) => pathname?.startsWith(route));
    const container = containerRef.current;

    if (container && prevPathRef.current !== pathname) {
      // Spatial clip & wipe transition for marketing routes, instant/fast for auth & legal
      if (isFast) {
        container.style.animation = "ktQuickPageReveal 180ms ease forwards";
      } else {
        container.style.animation = "ktSpatialPageWipe 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards";
      }

      // Accessibility: Move focus to the primary heading or container
      const heading = container.querySelector("h1") || container.querySelector("h2");
      if (heading && typeof heading.focus === "function") {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }

      prevPathRef.current = pathname;
    }
  }, [pathname, prefersReducedMotion]);

  return (
    <div
      className="kt-page-transition-boundary"
      ref={containerRef}
      style={{ width: "100%", minHeight: "100%" }}
    >
      {children}
    </div>
  );
}
