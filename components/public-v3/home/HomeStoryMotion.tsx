"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { refreshPublicMotion } from "../redesign/motion-refresh";
import { createHeroEntrance } from "./hero-entrance";

/** Section-specific motion, scoped and reverted when the route leaves. */
export function HomeStoryMotion() {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = anchor.current?.parentElement;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const editorialCleanups: Array<() => void> = [];
      let disposeHero: (() => void) | undefined;
      const ctx = gsap.context(() => {
        disposeHero = createHeroEntrance(root);
        root
          .querySelectorAll<HTMLElement>("[data-editorial-fade]")
          .forEach((element) => {
            const reveal = gsap.from(element, {
              opacity: 0,
              y: 22,
              duration: 1.15,
              ease: "power2.out",
              scrollTrigger: { trigger: element, start: "top 94%", once: true },
            });
            const show = () => {
              reveal.progress(1);
              reveal.scrollTrigger?.kill();
            };
            element.addEventListener("focusin", show);
            editorialCleanups.push(() =>
              element.removeEventListener("focusin", show),
            );
          });
        const hero = root.querySelector("[data-hero-window]");
        if (hero)
          gsap.fromTo(
            hero.querySelector("img"),
            { scale: 1.02, yPercent: 0 },
            {
              scale: 1.22,
              yPercent: 1,
              transformOrigin: "50% 48%",
              ease: "none",
              scrollTrigger: {
                trigger: hero,
                start: "top 80%",
                end: "bottom 15%",
                scrub: 1.1,
              },
            },
          );
        root
          .querySelectorAll<HTMLElement>("[data-gallery-drift]")
          .forEach((figure, index) => {
            gsap.from(figure, {
              y: index === 1 ? 100 : 45,
              ease: "none",
              scrollTrigger: {
                trigger: figure,
                start: "top 95%",
                end: "top 40%",
                scrub: 0.7,
              },
            });
          });
      }, root);
      return () => {
        editorialCleanups.forEach((dispose) => dispose());
        ctx.revert();
        disposeHero?.();
      };
    });
    media.add(
      "(min-width: 1000px) and (min-height: 520px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          const scene = root.querySelector("[data-orbit-scene]");
          if (scene) {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: scene,
                  start: "top 80px",
                  end: "+=1050",
                  pin: true,
                  scrub: 0.8,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                },
              })
              .fromTo(
                scene.querySelector("[data-orbit-photo]"),
                { clipPath: "circle(74% at 50% 50%)" },
                {
                  clipPath: "circle(23% at 75% 50%)",
                  duration: 1.3,
                  ease: "power2.inOut",
                },
                0,
              )
              .fromTo(
                scene.querySelector("[data-orbit-photo] img"),
                { scale: 1.14 },
                {
                  scale: 1.08,
                  xPercent: 23,
                  yPercent: 4,
                  duration: 1.3,
                  ease: "none",
                },
                0,
              )
              .fromTo(
                scene.querySelector("[data-orbit-copy]"),
                { opacity: 0, x: -40 },
                { opacity: 1, x: 0, duration: 0.55, ease: "power2.out" },
                0.85,
              )
              .to({}, { duration: 0.3 });
          }
          const steps = root.querySelectorAll<HTMLElement>(
            "[data-journey-step]",
          );
          const photos = root.querySelectorAll<HTMLElement>(
            "[data-journey-photo]",
          );
          steps.forEach((step, index) => {
            if (!index || !photos[index]) return;
            gsap.fromTo(
              photos[index],
              { autoAlpha: 0, clipPath: "inset(100% 0 0 0)", scale: 1.08 },
              {
                autoAlpha: 1,
                clipPath: "inset(0% 0 0 0)",
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: step,
                  start: "top 78%",
                  end: "top 33%",
                  scrub: 0.65,
                },
              },
            );
          });
        }, root);
        return () => ctx.revert();
      },
    );
    refreshPublicMotion();
    return () => media.revert();
  }, []);
  return <span ref={anchor} hidden />;
}
