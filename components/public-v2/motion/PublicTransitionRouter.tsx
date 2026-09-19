"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { gsap } from "./gsap-public";
import { usePublicMotionPreference } from "./usePublicMotionPreference";

interface SharedMediaData {
  id: string;
  src: string;
  alt?: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

interface TransitionContextValue {
  captureSourceMedia: (id: string, element: HTMLElement, src: string, alt?: string) => void;
  triggerMaterialTakeover: (color?: string) => void;
  activeSharedMedia: SharedMediaData | null;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function useTransitionContext() {
  const ctx = useContext(TransitionContext);
  if (!ctx) {
    throw new Error("useTransitionContext must be used within PublicTransitionRouter");
  }
  return ctx;
}

const QUIET_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/accept-invitation",
  "/account-locked",
  "/session-expired",
  "/security-verification",
  "/checkout",
  "/cart",
  "/contact",
  "/faq",
  "/safety",
  "/terms",
  "/privacy-policy",
  "/accessibility",
  "/cookie-policy",
];

export function PublicTransitionRouter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [activeSharedMedia, setActiveSharedMedia] = useState<SharedMediaData | null>(null);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [takeoverColor, setTakeoverColor] = useState("#F3F1EA");
  const containerRef = useRef<HTMLDivElement>(null);
  const flightProxyRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  const captureSourceMedia = useCallback(
    (id: string, element: HTMLElement, src: string, alt?: string) => {
      if (prefersReducedMotion) return;
      const rect = element.getBoundingClientRect();
      setActiveSharedMedia({
        id,
        src,
        alt,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [prefersReducedMotion]
  );

  const triggerMaterialTakeover = useCallback(
    (color = "#F3F1EA") => {
      if (prefersReducedMotion) return;
      setTakeoverColor(color);
      setTakeoverActive(true);
    },
    [prefersReducedMotion]
  );

  // Handle route changes
  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    const isQuiet = QUIET_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`));

    if (prefersReducedMotion) {
      prevPathRef.current = pathname;
      requestAnimationFrame(() => {
        setActiveSharedMedia(null);
        setTakeoverActive(false);
      });
      return;
    }

    let activeTween: gsap.core.Tween | null = null;
    let takeoverTimer: NodeJS.Timeout | null = null;

    // 1. Shared Media Flight Handoff
    if (activeSharedMedia) {
      const destinationEl = document.querySelector<HTMLElement>(
        `[data-kt-shared-target="${activeSharedMedia.id}"]`
      );

      if (destinationEl && flightProxyRef.current) {
        const destRect = destinationEl.getBoundingClientRect();
        const proxy = flightProxyRef.current;

        destinationEl.style.opacity = "0";

        activeTween = gsap.fromTo(
          proxy,
          {
            top: activeSharedMedia.rect.top,
            left: activeSharedMedia.rect.left,
            width: activeSharedMedia.rect.width,
            height: activeSharedMedia.rect.height,
            opacity: 1,
            borderRadius: "4px",
          },
          {
            top: destRect.top,
            left: destRect.left,
            width: destRect.width,
            height: destRect.height,
            borderRadius: "8px",
            duration: 0.38,
            ease: "power3.out",
            onComplete: () => {
              destinationEl.style.opacity = "1";
              setActiveSharedMedia(null);
            },
          }
        );
      } else {
        setActiveSharedMedia(null);
      }
    }

    // 2. Material Takeover Resolve
    if (takeoverActive) {
      takeoverTimer = setTimeout(() => {
        setTakeoverActive(false);
      }, 400);
    }

    // 3. Quiet Route vs Cinematic Reveal
    const container = containerRef.current;
    if (container && !activeSharedMedia && !takeoverActive) {
      if (isQuiet) {
        gsap.fromTo(
          container,
          { opacity: 0.4, y: 6 },
          { opacity: 1, y: 0, duration: 0.18, ease: "power1.out" }
        );
      } else {
        gsap.fromTo(
          container,
          { opacity: 0.7, y: 14 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
        );
      }
    }

    // Accessibility focus management
    const heading = container?.querySelector("h1") || container?.querySelector("h2");
    if (heading && typeof (heading as HTMLElement).focus === "function") {
      (heading as HTMLElement).setAttribute("tabindex", "-1");
      (heading as HTMLElement).focus({ preventScroll: true });
    }

    prevPathRef.current = pathname;

    return () => {
      if (activeTween) activeTween.kill();
      if (takeoverTimer) clearTimeout(takeoverTimer);
    };
  }, [pathname, activeSharedMedia, takeoverActive, prefersReducedMotion]);

  return (
    <TransitionContext.Provider
      value={{ captureSourceMedia, triggerMaterialTakeover, activeSharedMedia }}
    >
      <div ref={containerRef} className="w-full min-h-full">
        {children}
      </div>

      {/* Shared Media Flying Proxy */}
      {activeSharedMedia && (
        <div
          ref={flightProxyRef}
          className="fixed z-[999] pointer-events-none overflow-hidden shadow-2xl"
          style={{
            top: activeSharedMedia.rect.top,
            left: activeSharedMedia.rect.left,
            width: activeSharedMedia.rect.width,
            height: activeSharedMedia.rect.height,
          }}
          aria-hidden="true"
        >
          <div className="relative w-full h-full">
            <Image
              src={activeSharedMedia.src}
              alt={activeSharedMedia.alt || "Transitioning element"}
              fill
              className="object-cover"
              sizes="50vw"
              priority
            />
          </div>
        </div>
      )}

      {/* Material Takeover Fullscreen Curtain */}
      {takeoverActive && (
        <div
          className="fixed inset-0 z-[998] pointer-events-none transition-transform duration-400 ease-in-out"
          style={{ backgroundColor: takeoverColor }}
          aria-hidden="true"
        />
      )}
    </TransitionContext.Provider>
  );
}
