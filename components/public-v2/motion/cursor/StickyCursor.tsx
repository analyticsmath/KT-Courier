"use client";

import { useEffect, useState, useRef } from "react";
import { useFinePointer } from "../useFinePointer";
import { usePublicMotionPreference } from "../usePublicMotionPreference";

export function StickyCursor() {
  const isFinePointer = useFinePointer();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);
  const targetCoords = useRef<{ x: number; y: number }>({ x: -100, y: -100 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (!isFinePointer || prefersReducedMotion) return;

    const handlePointerMove = (e: PointerEvent) => {
      targetCoords.current = { x: e.clientX, y: e.clientY };

      const target = (e.target as HTMLElement | null)?.closest?.("[data-kt-sticky-mode], [data-kt-cursor]") as HTMLElement | null;
      if (target) {
        const mode = target.getAttribute("data-kt-sticky-mode") || target.getAttribute("data-kt-cursor");
        if (mode) {
          setActiveMode(mode.toUpperCase());
          setVisible(true);
          return;
        }
      }
      setVisible(false);
    };

    const handlePointerLeave = () => {
      setVisible(false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);

    // Smooth lerp loop for the indicator badge
    let currentX = -100;
    let currentY = -100;

    const loop = () => {
      currentX += (targetCoords.current.x - currentX) * 0.22;
      currentY += (targetCoords.current.y - currentY) * 0.22;
      setCoords({ x: currentX, y: currentY });
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isFinePointer, prefersReducedMotion]);

  if (!isFinePointer || prefersReducedMotion || !visible || !activeMode) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150"
      style={{
        transform: `translate3d(${coords.x + 18}px, ${coords.y + 18}px, 0)`,
        opacity: visible ? 1 : 0,
      }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0E1012]/95 border border-[#347CFB]/40 shadow-lg text-[10px] font-mono font-semibold tracking-wider text-[#F3F1EA] uppercase select-none rounded-[2px]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#347CFB] animate-pulse" />
        <span>{activeMode}</span>
      </div>
    </div>
  );
}
