"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { usePublicMotionPreference } from "./usePublicMotionPreference";
import "./route-transition.css";

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
  "/cart",
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
  const [transitionState, setTransitionState] = useState<"idle" | "animating">("idle");

  useEffect(() => {
    if (prefersReducedMotion) {
      prevPathRef.current = pathname;
      return;
    }

    const isFast = FAST_ROUTES.some((route) => pathname?.startsWith(route));
    const container = containerRef.current;

    if (container && prevPathRef.current !== pathname) {
      setTransitionState("animating");

      if (isFast) {
        container.style.animation = "ktQuickPageReveal 180ms ease forwards";
      } else {
        container.style.animation = "ktSpatialPageWipe 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards";
      }

      // Accessibility: move focus to main heading
      const heading = container.querySelector("h1") || container.querySelector("h2");
      if (heading && typeof (heading as HTMLElement).focus === "function") {
        (heading as HTMLElement).setAttribute("tabindex", "-1");
        (heading as HTMLElement).focus({ preventScroll: true });
      }

      const timer = setTimeout(() => {
        setTransitionState("idle");
      }, 500);

      prevPathRef.current = pathname;
      return () => clearTimeout(timer);
    }
  }, [pathname, prefersReducedMotion]);

  return (
    <div
      className="pageTransitionContainer"
      data-transitioning={transitionState === "animating" ? "true" : undefined}
      ref={containerRef}
    >
      {children}
    </div>
  );
}
