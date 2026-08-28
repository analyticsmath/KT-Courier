"use client";

import { useEffect, type ReactNode } from "react";
import { ScrollTrigger } from "./gsap-public";
import { usePublicMotionPreference } from "./usePublicMotionPreference";

export function PublicSmoothScroll({ children }: { children: ReactNode }) {
  const { prefersReducedMotion } = usePublicMotionPreference();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      ScrollTrigger.update();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [prefersReducedMotion]);

  return <>{children}</>;
}
