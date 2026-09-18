"use client";

import { useEffect, useState, useCallback } from "react";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";

const INTRO_STORAGE_KEY = "kt_home_intro_seen_v3";

export function HomepageIntroCurtain() {
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [mounted, setMounted] = useState(false);
  const [unsealed, setUnsealed] = useState(false);

  const triggerUnseal = useCallback(() => {
    if (unsealed) return;
    setUnsealed(true);
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // Ignore sessionStorage restrictions
    }
    // Remove from DOM after aperture mask scales through camera
    setTimeout(() => {
      setMounted(false);
    }, 600);
  }, [unsealed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadySeen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true";
    if (alreadySeen || prefersReducedMotion) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });

    // Auto-unseal after 650ms (never block content for multiple seconds)
    const timer = setTimeout(() => {
      triggerUnseal();
    }, 650);

    const handleEarlyDismiss = () => {
      triggerUnseal();
    };

    window.addEventListener("scroll", handleEarlyDismiss, { passive: true, once: true });
    window.addEventListener("keydown", handleEarlyDismiss, { once: true });
    window.addEventListener("pointerdown", handleEarlyDismiss, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("scroll", handleEarlyDismiss);
      window.removeEventListener("keydown", handleEarlyDismiss);
      window.removeEventListener("pointerdown", handleEarlyDismiss);
    };
  }, [prefersReducedMotion, triggerUnseal]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      onClick={triggerUnseal}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0E1012] pointer-events-auto select-none transition-all duration-500 ease-in-out ${
        unsealed
          ? "opacity-0 scale-150 pointer-events-none"
          : "opacity-100 scale-100"
      }`}
      style={{
        transformOrigin: "center center",
      }}
      role="presentation"
    >
      {/* Carbon opening plane with asymmetrical seam pressure & cobalt signal */}
      <div className="relative flex flex-col items-center justify-center">
        {/* Simplified KT Mark as Aperture */}
        <div className="relative flex items-center gap-3">
          <span className="font-sans font-black text-5xl md:text-7xl tracking-tighter text-[#F3F1EA]">
            KT
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#347CFB] shadow-[0_0_12px_#347CFB]" />
        </div>

        {/* Asymmetrical seam pressure line */}
        <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#347CFB] to-transparent mt-4 opacity-80" />

        <span className="mt-3 text-[10px] font-mono tracking-widest text-[#59626A] uppercase">
          SOUTH AFRICAN COMMERCE IN MOTION
        </span>
      </div>
    </div>
  );
}
