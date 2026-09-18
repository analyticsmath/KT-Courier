"use client";

import { useState, useRef, useEffect, type ReactNode, type HTMLAttributes } from "react";
import { useFinePointer } from "../useFinePointer";
import { usePublicMotionPreference } from "../usePublicMotionPreference";

interface MaskCursorProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  revealContent: ReactNode;
  maskRadius?: number;
  className?: string;
}

export function MaskCursor({
  children,
  revealContent,
  maskRadius = 110,
  className = "",
  ...props
}: MaskCursorProps) {
  const isFinePointer = useFinePointer();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isTouchRevealed, setIsTouchRevealed] = useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);

  useEffect(() => {
    if (!isFinePointer || prefersReducedMotion) return;

    const el = containerRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPos({ x, y });
    };

    const handleMouseLeave = () => {
      setPos(null);
    };

    el.addEventListener("mousemove", handleMouseMove, { passive: true });
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isFinePointer, prefersReducedMotion]);

  const handleFocus = () => {
    setIsKeyboardFocused(true);
  };

  const handleBlur = () => {
    setIsKeyboardFocused(false);
  };

  const handleTouchToggle = () => {
    if (!isFinePointer) {
      setIsTouchRevealed((prev) => !prev);
    }
  };

  // Determine active reveal clip path
  let clipPath = "circle(0px at 0px 0px)";
  const isRevealed =
    (isFinePointer && pos !== null) ||
    isKeyboardFocused ||
    (!isFinePointer && isTouchRevealed);

  if (isRevealed) {
    if (pos) {
      clipPath = `circle(${maskRadius}px at ${pos.x}px ${pos.y}px)`;
    } else {
      // Full reveal when keyboard focused or touch tapped
      clipPath = "circle(150% at 50% 50%)";
    }
  }

  return (
    <div
      ref={containerRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleTouchToggle}
      className={`relative overflow-hidden ${className}`}
      data-mask-cursor-container="true"
      {...props}
    >
      {/* Primary layer */}
      <div className="w-full h-full relative z-0">{children}</div>

      {/* Mask-revealed secondary layer */}
      <div
        className="absolute inset-0 z-10 pointer-events-none transition-[clip-path] duration-150 ease-out"
        style={{
          clipPath,
          WebkitClipPath: clipPath,
        }}
        aria-hidden={!isRevealed}
      >
        {revealContent}
      </div>

      {/* Subtle indicator ring on fine pointer */}
      {isFinePointer && pos && (
        <div
          className="absolute z-20 pointer-events-none rounded-full border border-white/60 shadow-[0_0_12px_rgba(52,124,251,0.35)] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out"
          style={{
            left: pos.x,
            top: pos.y,
            width: maskRadius * 2,
            height: maskRadius * 2,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
