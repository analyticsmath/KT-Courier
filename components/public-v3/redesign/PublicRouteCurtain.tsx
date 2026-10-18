"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import {
  isCinematicDestination,
  routeMotionLabel,
} from "./route-motion-policy";
import { refreshPublicMotion } from "./motion-refresh";
import styles from "./route-curtain.module.css";

/** Paired departure/arrival panels, including navigation from the persistent header/footer. */
export function PublicRouteCurtain() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const previous = useRef(pathname);
  const busy = useRef(false);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const curtain = root.current;
    if (!curtain) return;
    const panels = curtain.querySelectorAll("i");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const clear = () => {
      animation.current?.kill();
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = null;
      busy.current = false;
      gsap.set(curtain, { visibility: "hidden" });
      gsap.set(panels, { clearProps: "transform" });
      if (label.current)
        gsap.set(label.current, { clearProps: "transform,opacity" });
    };
    if (previous.current !== pathname) {
      animation.current?.kill();
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = null;
      busy.current = false;
      if (!reduced.matches && isCinematicDestination(pathname)) {
        if (label.current)
          label.current.textContent = routeMotionLabel(pathname);
        gsap.set(curtain, { visibility: "visible" });
        gsap.set(panels, { yPercent: 0 });
        animation.current = gsap
          .timeline({
            onComplete: () => {
              clear();
              refreshPublicMotion();
            },
          })
          .fromTo(
            label.current,
            { y: 0, opacity: 1 },
            { y: -40, opacity: 0, duration: 0.32, ease: "power2.in" },
            0.08,
          )
          .to(
            panels,
            {
              yPercent: -100,
              stagger: 0.08,
              duration: 0.72,
              ease: "power4.inOut",
            },
            0.14,
          );
      } else clear();
      previous.current = pathname;
    }
    const intercept = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        reduced.matches
      )
        return;
      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.closest("[data-no-route-motion]")
      )
        return;
      const destination = new URL(anchor.href, location.href);
      if (
        destination.origin !== location.origin ||
        destination.pathname === pathname ||
        !isCinematicDestination(destination.pathname)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (busy.current) return;
      busy.current = true;
      document
        .querySelector<HTMLDialogElement>("#kt-editorial-menu[open]")
        ?.close();
      if (label.current)
        label.current.textContent = routeMotionLabel(destination.pathname);
      gsap.set(curtain, { visibility: "visible" });
      gsap.set(panels, { yPercent: 100 });
      gsap.set(label.current, { y: 28, opacity: 0 });
      animation.current?.kill();
      animation.current = gsap
        .timeline({
          onComplete: () =>
            router.push(
              destination.pathname + destination.search + destination.hash,
            ),
        })
        .to(
          panels,
          { yPercent: 0, stagger: 0.065, duration: 0.45, ease: "power3.inOut" },
          0,
        )
        .to(
          label.current,
          { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
          0.22,
        );
      // Restore the current page if navigation cannot complete; never leave a blocking curtain.
      fallback.current = setTimeout(clear, 6000);
    };
    const onPreferenceChange = () => {
      if (reduced.matches) clear();
    };
    document.addEventListener("click", intercept, true);
    reduced.addEventListener("change", onPreferenceChange);
    return () => {
      document.removeEventListener("click", intercept, true);
      reduced.removeEventListener("change", onPreferenceChange);
      clear();
    };
  }, [pathname, router]);
  return (
    <div ref={root} className={styles.curtain} aria-hidden="true">
      <div className={styles.panels}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.label}>
        <span ref={label}>KT Couriers.</span>
      </div>
    </div>
  );
}
