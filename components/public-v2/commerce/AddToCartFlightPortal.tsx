"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { gsap } from "@/components/public-v2/motion/gsap-public";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";

export interface FlightPayload {
  sourceElement?: HTMLElement | null;
  imageSrc?: string;
  sourceRect?: { x: number; y: number; width: number; height: number };
}

interface ActiveFlight {
  id: string;
  imageSrc?: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  targetX: number;
  targetY: number;
}

export function triggerCartFlight(payload: FlightPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<FlightPayload>("kt-trigger-cart-flight", { detail: payload })
  );
}

export function AddToCartFlightPortal() {
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [activeFlights, setActiveFlights] = useState<ActiveFlight[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const startFlight = useCallback(
    (payload: FlightPayload) => {
      let startX = 0;
      let startY = 0;
      let startWidth = 48;
      let startHeight = 48;

      if (payload.sourceElement) {
        const rect = payload.sourceElement.getBoundingClientRect();
        startX = rect.left + rect.width / 2 - 24;
        startY = rect.top + rect.height / 2 - 24;
        startWidth = Math.min(rect.width, 64);
        startHeight = Math.min(rect.height, 64);
      } else if (payload.sourceRect) {
        startX = payload.sourceRect.x;
        startY = payload.sourceRect.y;
        startWidth = payload.sourceRect.width;
        startHeight = payload.sourceRect.height;
      } else {
        return;
      }

      // Discover authoritative target element
      const isMobile = window.innerWidth <= 1023;
      let targetEl: HTMLElement | null = null;

      if (isMobile) {
        targetEl =
          document.querySelector<HTMLElement>('[data-kt-cart-target="mobile-bottom-nav"]') ||
          document.querySelector<HTMLElement>('[data-kt-cart-target="mobile-header"]');
      } else {
        targetEl = document.querySelector<HTMLElement>('[data-kt-cart-target="header"]');
      }

      // Fallback to any visible cart target
      if (!targetEl) {
        targetEl = document.querySelector<HTMLElement>('[data-kt-cart-target]');
      }

      if (!targetEl) {
        // No visual target in DOM: immediately dispatch update
        window.dispatchEvent(new CustomEvent("kt-cart-updated"));
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2 - 16;
      const targetY = targetRect.top + targetRect.height / 2 - 16;

      if (prefersReducedMotion) {
        // Instant target pulse, no flight
        targetEl.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.25)", filter: "brightness(1.2)" },
            { transform: "scale(1)" },
          ],
          { duration: 240, easing: "ease-out" }
        );
        window.dispatchEvent(new CustomEvent("kt-cart-updated"));
        return;
      }

      const flightId = `flight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const flightData: ActiveFlight = {
        id: flightId,
        imageSrc: payload.imageSrc,
        startX,
        startY,
        startWidth,
        startHeight,
        targetX,
        targetY,
      };

      setActiveFlights((prev) => [...prev, flightData]);

      // Request next frame to mount and animate
      requestAnimationFrame(() => {
        const flightEl = document.getElementById(flightId);
        if (!flightEl) return;

        const distanceY = targetY - startY;
        const arcPeak = Math.min(-60, -Math.abs(distanceY * 0.4) - 40);

        const tl = gsap.timeline({
          onComplete: () => {
            setActiveFlights((prev) => prev.filter((f) => f.id !== flightId));
            window.dispatchEvent(new CustomEvent("kt-cart-updated"));

            if (targetEl) {
              gsap.fromTo(
                targetEl,
                { scale: 0.8 },
                { scale: 1.25, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 }
              );
            }
          },
        });

        // Parabolic trajectory: X progresses smoothly, Y arcs upwards before landing
        tl.fromTo(
          flightEl,
          {
            x: startX,
            y: startY,
            scale: 1,
            opacity: 1,
            borderRadius: "8px",
          },
          {
            x: targetX,
            duration: 0.65,
            ease: "power1.inOut",
          },
          0
        );

        tl.to(
          flightEl,
          {
            y: startY + arcPeak,
            duration: 0.28,
            ease: "power2.out",
          },
          0
        );

        tl.to(
          flightEl,
          {
            y: targetY,
            duration: 0.37,
            ease: "power2.in",
          },
          0.28
        );

        tl.to(
          flightEl,
          {
            scale: 0.35,
            opacity: 0.75,
            duration: 0.25,
            ease: "power1.in",
          },
          0.4
        );
      });
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<FlightPayload>;
      if (customEvent.detail) {
        startFlight(customEvent.detail);
      }
    };

    window.addEventListener("kt-trigger-cart-flight", handleTrigger);
    return () => {
      window.removeEventListener("kt-trigger-cart-flight", handleTrigger);
    };
  }, [startFlight]);

  if (activeFlights.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100svh",
        pointerEvents: "none",
        zIndex: 9990,
      }}
    >
      {activeFlights.map((flight) => (
        <div
          id={flight.id}
          key={flight.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "48px",
            height: "48px",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 12px 28px rgba(14, 16, 18, 0.45), 0 0 0 1px rgba(52, 124, 251, 0.4)",
            backgroundColor: "var(--kt-carbon, #0e1012)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          {flight.imageSrc ? (
            <Image
              alt=""
              fill
              sizes="48px"
              src={flight.imageSrc}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "1.25rem" }}>📦</span>
          )}
        </div>
      ))}
    </div>
  );
}
