"use client";

import Image from "next/image";
import { VAN_STATES, type VanStateId } from "./actor-state-machine";

interface VanActorProps {
  stateId: VanStateId;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Van Protagonist Actor.
 * Used for collection sequences and street movement.
 * Door opening is strictly a consequence of van arrival and stopping.
 */
export function VanActor({
  stateId = "side-right",
  priority = false,
  className = "",
  style = {},
}: VanActorProps) {
  const isSideProfile = stateId === "side-right" || stateId === "sliding-door-open";
  const isDoorOpen = stateId === "sliding-door-open";
  const baseActor = isSideProfile ? VAN_STATES["side-right"] : (VAN_STATES[stateId] ?? VAN_STATES["side-right"]);
  const doorOpenActor = VAN_STATES["sliding-door-open"];

  return (
    <div
      className={`kt-van-actor select-none pointer-events-none ${className}`}
      data-actor="van"
      data-state={stateId}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      {/* Base van silhouette (closed side profile or current state) */}
      <Image
        src={baseActor.webpSrc}
        alt={baseActor.alt}
        width={baseActor.width}
        height={baseActor.height}
        priority={priority}
        sizes="(max-width: 767px) 90vw, 1200px"
        className="w-full h-auto object-contain"
        style={{
          maxWidth: "100%",
          height: "auto",
          display: "block",
        }}
      />

      {/* Continuous GSAP-controlled door aperture: permanently clipped to calibrated door region */}
      {isSideProfile && (
        <div
          className="van-door-boundary pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            clipPath: "inset(15% 36% 22% 32%)",
          }}
          aria-hidden="true"
        >
          {/* Target for GSAP Collection timeline to control door reveal/scrub */}
          <div
            data-van-door-window="true"
            className="van-door-window absolute inset-0 will-change-transform"
            style={{
              opacity: isDoorOpen ? 1 : 0,
            }}
          >
            <Image
              src={doorOpenActor.webpSrc}
              alt={doorOpenActor.alt}
              width={doorOpenActor.width}
              height={doorOpenActor.height}
              sizes="(max-width: 767px) 90vw, 1200px"
              className="w-full h-auto object-contain"
              style={{
                maxWidth: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
