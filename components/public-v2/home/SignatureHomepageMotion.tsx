"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./signature-home.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function SignatureHomepageMotion() {
  const anchor = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const root = anchor.current?.parentElement;
    if (!root) return undefined;
    const context = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const media = gsap.matchMedia();
      media.add({ wide: "(min-width: 768px) and (prefers-reduced-motion: no-preference)", narrow: "(max-width: 767px) and (prefers-reduced-motion: no-preference)" }, (scope) => {
        if (!scope.conditions?.wide) return undefined;
        const stageA = q<HTMLElement>("[data-stage='a']")[0]; const stageB = q<HTMLElement>("[data-stage='b']")[0]; const stageC = q<HTMLElement>("[data-stage='c']")[0];
        if (stageA) gsap.timeline({ scrollTrigger: { trigger: stageA, start: "top top", end: "bottom bottom", scrub: .48 } }).to(q(`.${styles.aWorld}`), { scale: 1.1, xPercent: -9, yPercent: -3 }, 0).to(q("[data-a-band]"), { yPercent: 115 }, .22).to(q(`.${styles.aThreshold}`), { autoAlpha: 1, xPercent: -7, scale: 1 }, .28).to(q("[data-actor='a-choice']"), { autoAlpha: 1, x: 0 }, .37).to(q(`.${styles.aThreshold}`), { xPercent: -115, width: "58vw", height: "72vh", top: "12vh", right: "20vw" }, .56).to(q(`.${styles.aMerchant}`), { clipPath: "inset(0 0 0 0)", autoAlpha: 1 }, .64).to(q("[data-actor='a-merchant-copy']"), { autoAlpha: 1 }, .75);
        if (stageB) gsap.timeline({ scrollTrigger: { trigger: stageB, start: "top top", end: "bottom bottom", scrub: .58 } }).to(q(`.${styles.bMerchant}`), { scale: .7, xPercent: -42, autoAlpha: .25 }, 0).to(q(`.${styles.bObject}`), { autoAlpha: 1, scale: 1.05 }, 0).to(q(`.${styles.bObject}`), { width: "72vw", height: "66vh", left: "14vw", bottom: "16vh" }, .28).to(q(`.${styles.bHandoff}`), { autoAlpha: 1, clipPath: "inset(0 0 0 0)" }, .35).to(q("[data-actor='handoff-copy']"), { autoAlpha: 1 }, .47).to(q(`.${styles.bHandoff}`), { xPercent: 110, autoAlpha: 0 }, .67).to(q(`.${styles.bMovement}`), { autoAlpha: 1, scale: 1 }, .68).to(q("[data-actor='movement-copy']"), { autoAlpha: 1 }, .79);
        if (stageC) gsap.timeline({ scrollTrigger: { trigger: stageC, start: "top top", end: "bottom bottom", scrub: .65 } }).to(q(`.${styles.cMovement}`), { autoAlpha: 1, scale: 1 }, 0).to(q("[data-actor='network-copy']"), { autoAlpha: 1 }, .08).to(q(`.${styles.cAbundance}`), { autoAlpha: 1, xPercent: -34 }, .16).to(q(`.${styles.cDiscovery}`), { autoAlpha: 1, xPercent: 24 }, .21).to(q(`.${styles.cThreshold}`), { autoAlpha: 1, xPercent: 18 }, .26).to(q("[data-actor='network-copy']"), { autoAlpha: .08, yPercent: -18 }, .45).to(q(`.${styles.cMovement}, .${styles.cAbundance}, .${styles.cDiscovery}, .${styles.cThreshold}`), { xPercent: -125, autoAlpha: 0 }, .48).to(q("[data-actor='marketplace-state']"), { autoAlpha: 1, y: 0, backgroundColor: "#fff" }, .63);
        return undefined;
      });
      const refresh = () => ScrollTrigger.refresh();
      void document.fonts?.ready.then(refresh).catch(() => undefined);
      window.addEventListener("load", refresh, { once: true });
      return () => { window.removeEventListener("load", refresh); media.revert(); };
    }, root);
    return () => context.revert();
  }, { scope: anchor });
  return <span aria-hidden="true" ref={anchor} />;
}
