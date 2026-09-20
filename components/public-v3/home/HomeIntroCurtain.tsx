"use client";

import { useEffect, useRef, useState } from "react";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import styles from "./home-intro-curtain.module.css";

const INTRO_SESSION_KEY = "kt_home_intro_seen_v4";

export function HomeIntroCurtain({ onResolved }: { onResolved: () => void }) {
  const [visible, setVisible] = useState(true);
  const completed = useRef(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";
    const delay = seen ? 0 : reducedMotion ? 220 : 1450;
    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
      setVisible(false);
      onResolved();
    };
    const timeout = window.setTimeout(finish, delay);
    return () => window.clearTimeout(timeout);
  }, [onResolved]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    const preventScroll = (event: Event) => event.preventDefault();
    const preventKeys = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) event.preventDefault();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", preventKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", preventKeys);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={styles.curtain} data-home-intro-curtain aria-hidden="true">
      <div className={`${styles.panel} ${styles.panelLeft}`} />
      <div className={`${styles.panel} ${styles.panelRight}`} />
      <div className={styles.seam} />
      <div className={styles.logo}>
        <CanonicalKtLogo size="fill" priority alt="" />
      </div>
    </div>
  );
}
