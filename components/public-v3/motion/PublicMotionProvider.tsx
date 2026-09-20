"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useReducedMotionMode } from "./useReducedMotionMode";
import { useFinePointer } from "./useFinePointer";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const EXCLUDED_LENIS_PREFIXES = [
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
  "/account",
];

interface MotionContextValue {
  prefersReducedMotion: boolean;
  isFinePointer: boolean;
  headerTone: "light" | "dark";
  setHeaderTone: (tone: "light" | "dark") => void;
}

const MotionContext = createContext<MotionContextValue>({
  prefersReducedMotion: false,
  isFinePointer: true,
  headerTone: "light",
  setHeaderTone: () => {},
});

export function useMotionContext() {
  return useContext(MotionContext);
}

export function PublicMotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotionMode();
  const isFinePointer = useFinePointer();
  const [headerTone, setHeaderTone] = useState<"light" | "dark">("light");
  const lenisRef = useRef<Lenis | null>(null);

  const isExcludedRoute = EXCLUDED_LENIS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // Initialize Lenis temporal smoothing strictly on desktop fine-pointer non-transactional routes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefersReducedMotion || !isFinePointer || isExcludedRoute) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1.0,
      autoRaf: false,
    });
    lenisRef.current = lenis;

    const handleScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on("scroll", handleScroll);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", handleScroll);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [pathname, prefersReducedMotion, isFinePointer, isExcludedRoute]);

  // Header contrast detection between Freight Paper (#F2EFE8) and Asphalt (#0B0D0F) scenes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // The homepage director resolves header tone from the same frame as its actors.
    // A second geometry scanner would compete with that chapter ownership.
    if (pathname === "/") {
      setHeaderTone("light");
      return;
    }

    const evaluateTone = () => {
      const darkSections = document.querySelectorAll(
        "[data-kt-contrast='dark'], [data-kt-scene-theme='dark']"
      );
      let isDarkUnderHeader = false;
      const headerThreshold = 72;

      for (let i = 0; i < darkSections.length; i++) {
        const rect = darkSections[i].getBoundingClientRect();
        if (rect.top <= headerThreshold && rect.bottom >= 36) {
          isDarkUnderHeader = true;
          break;
        }
      }

      setHeaderTone(isDarkUnderHeader ? "dark" : "light");
    };

    window.addEventListener("scroll", evaluateTone, { passive: true });
    evaluateTone();

    return () => {
      window.removeEventListener("scroll", evaluateTone);
    };
  }, [pathname, setHeaderTone]);

  return (
    <MotionContext.Provider
      value={{
        prefersReducedMotion,
        isFinePointer,
        headerTone,
        setHeaderTone,
      }}
    >
      {children}
    </MotionContext.Provider>
  );
}
