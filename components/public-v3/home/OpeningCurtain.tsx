"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { refreshPublicMotion } from "../redesign/motion-refresh";
import styles from "./opening-curtain.module.css";

/** A bounded entrance; it never locks scrolling or waits indefinitely for media. */
export function OpeningCurtain() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const curtain = root.current;
    if (!curtain) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let finished = false;
    let timeline: gsap.core.Timeline | undefined;
    let release: ReturnType<typeof setTimeout> | undefined;
    const dismiss = () => {
      if (finished) return;
      finished = true;
      timeline?.kill();
      curtain.style.visibility = "hidden";
      window.dispatchEvent(new Event("kt:opening-complete"));
      refreshPublicMotion();
    };
    const onPreference = () => {
      if (preference.matches) dismiss();
    };
    preference.addEventListener("change", onPreference);
    if (preference.matches) dismiss();
    else {
      const hero = document.querySelector<HTMLImageElement>(
        "[data-hero-window] img",
      );
      const ready = Promise.allSettled([
        document.fonts.ready,
        hero?.decode() ?? Promise.resolve(),
      ]);
      const minimum = new Promise<void>((resolve) => {
        release = setTimeout(resolve, 650);
      });
      let deadline: ReturnType<typeof setTimeout>;
      const maximum = new Promise<void>((resolve) => {
        deadline = setTimeout(resolve, 1700);
      });
      void Promise.race([Promise.all([ready, minimum]), maximum]).then(() => {
        clearTimeout(deadline);
        if (disposed || finished || preference.matches) return;
        timeline = gsap
          .timeline({ onComplete: dismiss })
          .to(curtain.querySelector("[data-opening-mark]"), {
            opacity: 0,
            scale: 0.9,
            duration: 0.3,
            ease: "power2.in",
          })
          .to(
            curtain.querySelector("[data-curtain-left]"),
            { xPercent: -101, duration: 1.05, ease: "power4.inOut" },
            0.12,
          )
          .to(
            curtain.querySelector("[data-curtain-right]"),
            { xPercent: 101, duration: 1.05, ease: "power4.inOut" },
            0.12,
          );
      });
      // Also covers an interrupted animation or failed enhancement.
      const safety = setTimeout(dismiss, 3500);
      return () => {
        disposed = true;
        clearTimeout(safety);
        clearTimeout(release);
        clearTimeout(deadline);
        timeline?.kill();
        preference.removeEventListener("change", onPreference);
      };
    }
    return () => {
      disposed = true;
      preference.removeEventListener("change", onPreference);
    };
  }, []);
  return (
    <div ref={root} className={styles.curtain} aria-hidden="true">
      <div className={styles.left} data-curtain-left />
      <div className={styles.right} data-curtain-right />
      <div className={styles.mark} data-opening-mark>
        <i className={styles.outer} />
        <i className={styles.inner} />
        <CanonicalKtLogo size={96} />
        <span>A little closer.</span>
      </div>
    </div>
  );
}
