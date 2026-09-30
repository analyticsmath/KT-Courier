"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import styles from "./home-intro-curtain.module.css";

const INTRO_SESSION_KEY = "kt_home_intro_seen_v5";

export function HomeIntroCurtain({ onResolved }: { onResolved: () => void }) {
  const [visible, setVisible] = useState(true);
  const curtainRef = useRef<HTMLDivElement>(null);
  const completed = useRef(false);

  useEffect(() => {
    const curtain = curtainRef.current;
    if (!curtain) return;

    const replayRequested = new URLSearchParams(window.location.search).get("ktIntro") === "1";
    let hasSeenIntro = false;
    try {
      hasSeenIntro = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";
    } catch {
      // Storage may be unavailable in private browsing; the intro can still run once.
    }

    if (hasSeenIntro && !replayRequested) {
      setVisible(false);
      onResolved();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const preventScroll = (event: Event) => event.preventDefault();
    const preventKeys = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
        event.preventDefault();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", preventKeys);

    const complete = () => {
      if (completed.current) return;
      completed.current = true;
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
      } catch {
        // A storage failure must not prevent the hero from becoming available.
      }
      setVisible(false);
      onResolved();
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      const content = curtain.querySelector<HTMLElement>("[data-curtain-content]");
      const leftPanel = curtain.querySelector<HTMLElement>("[data-curtain-panel='left']");
      const rightPanel = curtain.querySelector<HTMLElement>("[data-curtain-panel='right']");
      const seam = curtain.querySelector<HTMLElement>("[data-curtain-seam]");

      if (reducedMotion) {
        gsap.timeline({ onComplete: complete }).to(curtain, {
          autoAlpha: 0,
          duration: 0.22,
          ease: "none",
        });
        return;
      }

      if (!content || !leftPanel || !rightPanel || !seam) {
        complete();
        return;
      }

      const splitStart = 1.28;
      const splitDuration = window.matchMedia("(max-width: 767px)").matches ? 0.98 : 1.02;
      const timeline = gsap.timeline({ onComplete: complete });
      timeline.fromTo(content, { autoAlpha: 0, scale: 0.94 }, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
      }, 0.15);
      timeline.fromTo(seam, { autoAlpha: 0, scaleY: 0 }, {
        autoAlpha: 0.66,
        scaleY: 1,
        duration: 0.2,
        ease: "power2.out",
      }, 1.04);

      // A short, restrained pull at the seam creates tension before the main release.
      timeline.to(leftPanel, { x: -6, duration: 0.1, ease: "power1.out" }, 1.18);
      timeline.to(rightPanel, { x: 6, duration: 0.1, ease: "power1.out" }, 1.18);
      timeline.to(leftPanel, { xPercent: -105, duration: splitDuration, ease: "power3.inOut" }, splitStart);
      timeline.to(rightPanel, { xPercent: 105, duration: splitDuration, ease: "power3.inOut" }, splitStart);

      // Keep the title card present until the panels have started to uncover the hero.
      timeline.to(content, { autoAlpha: 0, scale: 0.97, duration: 0.32, ease: "power2.in" }, 1.4);
      timeline.to(seam, { autoAlpha: 0.76, duration: 0.08, ease: "power2.out" }, splitStart);
      timeline.to(seam, {
        autoAlpha: 0,
        duration: splitDuration * 0.3,
        ease: "power2.in",
      }, splitStart + 0.08);
    }, curtain);

    return () => {
      context.revert();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", preventKeys);
    };
  }, [onResolved, visible]);

  if (!visible) return null;

  return (
    <div ref={curtainRef} className={styles.curtain} data-home-intro-curtain aria-hidden="true">
      <div className={`${styles.panel} ${styles.panelLeft}`} data-curtain-panel="left" />
      <div className={`${styles.panel} ${styles.panelRight}`} data-curtain-panel="right" />
      <div className={styles.seam} data-curtain-seam />
      <div className={styles.curtainContent} data-curtain-content>
        <div className={styles.logo}>
          <CanonicalKtLogo size="fill" priority alt="" />
        </div>
      </div>
    </div>
  );
}
