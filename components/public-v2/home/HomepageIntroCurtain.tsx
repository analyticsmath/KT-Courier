"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import styles from "./intro-curtain.module.css";

const INTRO_STORAGE_KEY = "kt_home_intro_seen";

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
      // Ignore storage restrictions
    }
    // Remove from DOM after transition completes
    setTimeout(() => {
      setMounted(false);
    }, 650);
  }, [unsealed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user already saw intro this session, or prefers reduced motion
    const alreadySeen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true";
    if (alreadySeen || prefersReducedMotion) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });

    // Auto-unseal after brief dramatic beat (750ms)
    const timer = setTimeout(() => {
      triggerUnseal();
    }, 750);

    // Any user interaction (scroll, click, keydown) unseals immediately
    const handleEarlyDismiss = () => {
      triggerUnseal();
    };

    window.addEventListener("scroll", handleEarlyDismiss, { passive: true, once: true });
    window.addEventListener("keydown", handleEarlyDismiss, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("scroll", handleEarlyDismiss);
      window.removeEventListener("keydown", handleEarlyDismiss);
    };
  }, [prefersReducedMotion, triggerUnseal]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={styles.curtainRoot}
      data-unsealed={unsealed}
      onClick={triggerUnseal}
      role="presentation"
    >
      <div className={styles.curtainBackground}>
        <Image
          alt={ktMedia.routes.nightTransitCorridor.alt}
          fill
          priority
          sizes="100vw"
          src={ktMedia.routes.nightTransitCorridor.src}
        />
        <div className={styles.curtainScrim} />
      </div>

      <div className={styles.curtainContent}>
        <span className={styles.curtainLabel}>
          <span className={styles.curtainPulseDot} />
          <span>EST. SOUTH AFRICA · FREIGHT & COMMERCE</span>
        </span>

        <h1 className={styles.curtainMasthead}>
          KT COURIERS
        </h1>

        <p className={styles.curtainSubtext}>
          South African commerce in motion. Two sides of one moving system.
        </p>

        <span className={styles.curtainInteractionNotice}>
          [ Click, tap or scroll to begin ]
        </span>
      </div>
    </div>
  );
}
