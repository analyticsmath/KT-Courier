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
              { xPercent: -110 },
              {
                xPercent: 24,
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
    return () => mm.revert();
  }, []);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
