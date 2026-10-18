"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Local, reversible enhancements. Content is visible before JS and without motion. */
export function EditorialMotion({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const title = root.current?.querySelector("[data-title-reveal]");
        if (title)
          gsap.from(title.children, {
            y: 35,
            opacity: 0,
            stagger: 0.12,
            duration: 1.1,
            ease: "power3.out",
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-contained-vehicle]")
          .forEach((vehicle) => {
            gsap.fromTo(
              vehicle,
              {
                xPercent: () => (window.innerWidth <= 760 ? -3 : -7),
                scale: 0.94,
              },
              {
                xPercent: () => (window.innerWidth <= 760 ? 3 : 7),
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: vehicle.closest("[data-vehicle-scene]"),
                  start: "top 80%",
                  end: "bottom 20%",
                  scrub: 0.65,
                  invalidateOnRefresh: true,
                },
              },
            );
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-montage]")
          .forEach((montage) => {
            gsap.fromTo(
              montage.querySelector(".kt-montage-detail"),
              { yPercent: 12, rotate: -4 },
              {
                yPercent: -8,
                rotate: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: montage,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.7,
                },
              },
            );
            gsap.fromTo(
              montage.querySelector(".kt-montage-city"),
              { yPercent: -10 },
              {
                yPercent: 22,
                ease: "none",
                scrollTrigger: {
                  trigger: montage,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.7,
                },
              },
            );
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-card-sequence]")
          .forEach((sequence) => {
            Array.from(sequence.children).forEach((card, index) => {
              gsap.from(card, {
                y: 75 + index * 25,
                rotation: index === 1 ? 2 : -2,
                opacity: 0.3,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  start: "top 96%",
                  end: "top 48%",
                  scrub: 0.6,
                },
              });
            });
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-wordmark] span")
          .forEach((wordmark) => {
            gsap.from(wordmark, {
              yPercent: 70,
              opacity: 0.2,
              ease: "none",
              scrollTrigger: {
                trigger: wordmark.parentElement,
                start: "top 98%",
                end: "top 78%",
                scrub: 0.5,
              },
            });
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-reveal]")
          .forEach((element) => {
            gsap.from(element, {
              y: 48,
              opacity: 0,
              duration: 0.85,
              ease: "power3.out",
              scrollTrigger: { trigger: element, start: "top 94%", once: true },
            });
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-parallax]")
          .forEach((element) => {
            gsap.fromTo(
              element,
              { yPercent: -5, scale: 1.13 },
              {
                yPercent: 5,
                scale: 1.13,
                ease: "none",
                scrollTrigger: {
                  trigger: element.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-lateral]")
          .forEach((element) => {
            gsap.fromTo(
              element,
              { xPercent: -3 },
              {
                xPercent: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: element.parentElement,
                  start: "top 85%",
                  end: "bottom 15%",
                  scrub: 0.35,
                  invalidateOnRefresh: true,
                },
              },
            );
          });
        root.current
          ?.querySelectorAll<HTMLElement>("[data-photo-takeover]")
          .forEach((field) => {
            const front = field.querySelector(".kt-photo-tall");
            const detail = field.querySelector(".kt-photo-offset");
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: field,
                  start: "top 80%",
                  end: "bottom 25%",
                  scrub: true,
                },
              })
              .to(
                front,
                { scale: 1.12, transformOrigin: "left center", ease: "none" },
                0,
              )
              .to(detail, { xPercent: -22, yPercent: -18, ease: "none" }, 0);
          });
      }, root);
      return () => ctx.revert();
    });
    mm.add(
      "(min-width: 1000px) and (min-height: 520px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          root.current
            ?.querySelectorAll<HTMLElement>("[data-local-reel]")
            .forEach((reel) => {
              const viewport =
                reel.querySelector<HTMLElement>(".kt-reel-window");
              const track = reel.querySelector<HTMLElement>(".kt-reel-track");
              if (!viewport || !track) return;
              gsap.set(viewport, { overflow: "hidden" });
              gsap.to(track, {
                x: () => -(track.scrollWidth - viewport.clientWidth),
                ease: "none",
                scrollTrigger: {
                  trigger: viewport,
                  start: "top 20%",
                  end: () =>
                    `+=${Math.max(1, track.scrollWidth - viewport.clientWidth)}`,
                  pin: true,
                  scrub: 0.7,
                  invalidateOnRefresh: true,
                  anticipatePin: 1,
                },
              });
            });
        }, root);
        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
