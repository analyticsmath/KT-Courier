"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export type MaskRevealProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
};

const clipPaths = {
  up: {
    initial: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
    animate: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  down: {
    initial: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
    animate: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  left: {
    initial: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)",
    animate: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
  right: {
    initial: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)",
    animate: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
  },
} as const;

export function MaskReveal({
  children,
  delay = 0,
  duration = 0.6,
  direction = "up",
  className = "",
}: MaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const path = clipPaths[direction];
    gsap.fromTo(
      containerRef.current,
      { clipPath: path.initial, opacity: 0.8 },
      {
        clipPath: path.animate,
        opacity: 1,
        duration,
        delay,
        ease: "power3.out",
      }
    );
  }, [delay, duration, direction]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ clipPath: clipPaths[direction].initial }}
    >
      {children}
    </div>
  );
}
