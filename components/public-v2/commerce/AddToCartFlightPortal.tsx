"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const timelinesRef = useRef(new Map<string, gsap.core.Timeline>());
  const safetyTimersRef = useRef(new Map<string, number>());
  const animationFramesRef = useRef(new Map<string, number[]>());

  const removeFlight = useCallback((flightId: string) => {
    setActiveFlights((current) =>
      current.filter((flight) => flight.id !== flightId)
    );
  }, []);

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

      // Keep the established mobile target priority, including the PDP header cart.
      const isMobile = window.innerWidth <= 1023;
      let targetEl: HTMLElement | null = null;

      if (isMobile) {
        targetEl =
          document.querySelector<HTMLElement>(
            '[data-kt-cart-target="mobile-bottom-nav"]'
          ) ||
          document.querySelector<HTMLElement>(
            '[data-kt-cart-target="mobile-header"]'
          );
      } else {
        targetEl = document.querySelector<HTMLElement>(
          '[data-kt-cart-target="header"]'
        );
      }

      if (!targetEl) {
        targetEl = document.querySelector<HTMLElement>("[data-kt-cart-target]");
      }

      if (!targetEl) {
        window.dispatchEvent(new CustomEvent("kt-cart-updated"));
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2 - 16;
      const targetY = targetRect.top + targetRect.height / 2 - 16;

      if (prefersReducedMotion) {
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

      const flightId =
        "flight-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
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
      let finished = false;
      let safetyTimer: number | null = null;

      const finishFlight = () => {
        if (finished) return;
        finished = true;

        if (safetyTimer !== null) window.clearTimeout(safetyTimer);
        safetyTimersRef.current.delete(flightId);

        const pendingFrames = animationFramesRef.current.get(flightId);
        pendingFrames?.forEach((frameId) =>
          window.cancelAnimationFrame(frameId)
        );
        animationFramesRef.current.delete(flightId);

        const timeline = timelinesRef.current.get(flightId);
        timelinesRef.current.delete(flightId);
        timeline?.kill();

        removeFlight(flightId);
        window.dispatchEvent(new CustomEvent("kt-cart-updated"));

        if (targetEl?.isConnected) {
          gsap.fromTo(
            targetEl,
            { scale: 0.8 },
            {
              scale: 1.25,
              duration: 0.16,
              ease: "power2.out",
              yoyo: true,
              repeat: 1,
            }
          );
        }
      };

      safetyTimer = window.setTimeout(finishFlight, 1400);
      safetyTimersRef.current.set(flightId, safetyTimer);
      setActiveFlights((current) => [...current, flightData]);

      const frameIds: number[] = [];
      animationFramesRef.current.set(flightId, frameIds);
      const firstFrame = window.requestAnimationFrame(() => {
        if (finished) return;

        const secondFrame = window.requestAnimationFrame(() => {
          if (finished) return;

          const flightEl = document.getElementById(flightId);
          if (!flightEl || !targetEl?.isConnected) {
            finishFlight();
            return;
          }

          const distanceY = targetY - startY;
          const arcPeak = Math.min(-60, -Math.abs(distanceY * 0.4) - 40);
          const timeline = gsap.timeline({
            onComplete: finishFlight,
            onInterrupt: finishFlight,
          });
          timelinesRef.current.set(flightId, timeline);

          timeline.fromTo(
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

          timeline.to(
            flightEl,
            {
              y: startY + arcPeak,
              duration: 0.28,
              ease: "power2.out",
            },
            0
          );

          timeline.to(
            flightEl,
            {
              y: targetY,
              duration: 0.37,
              ease: "power2.in",
            },
            0.28
          );

          timeline.to(
            flightEl,
            {
              scale: 0.18,
              opacity: 0,
              duration: 0.18,
              ease: "power1.in",
            },
            0.48
          );
        });
        frameIds.push(secondFrame);
      });
      frameIds.push(firstFrame);
    },
    [prefersReducedMotion, removeFlight]
  );

  useEffect(() => {
    const timelines = timelinesRef.current;
    const safetyTimers = safetyTimersRef.current;
    const animationFrames = animationFramesRef.current;
    const handleTrigger = (event: Event) => {
      const customEvent = event as CustomEvent<FlightPayload>;
      if (customEvent.detail) startFlight(customEvent.detail);
    };

    window.addEventListener("kt-trigger-cart-flight", handleTrigger);
    return () => {
      window.removeEventListener("kt-trigger-cart-flight", handleTrigger);

      for (const timeline of [...timelines.values()]) {
        timeline.kill();
      }
      timelines.clear();

      safetyTimers.forEach((timerId) => window.clearTimeout(timerId));
      safetyTimers.clear();

      animationFrames.forEach((frameIds) =>
        frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId))
      );
      animationFrames.clear();
      setActiveFlights([]);
    };
  }, [startFlight]);

  if (activeFlights.length === 0) return null;

  return (
    <div
      aria-hidden="true"
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
            boxShadow:
              "0 12px 28px rgba(14, 16, 18, 0.45), 0 0 0 1px rgba(52, 124, 251, 0.4)",
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
            <svg
              aria-hidden="true"
              fill="none"
              height="22"
              viewBox="0 0 24 24"
              width="22"
            >
              <path
                d="M4 8h16l-1.5 12h-13L4 8Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
              <path
                d="M8 9V6a4 4 0 0 1 8 0v3"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.7"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
