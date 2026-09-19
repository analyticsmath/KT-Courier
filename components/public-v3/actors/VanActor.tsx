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

      {/* Localized door reveal layer (180-320ms reveal across door seam, no full-vehicle dissolve) */}
      {isSideProfile && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            opacity: isDoorOpen ? 1 : 0,
            clipPath: isDoorOpen
              ? "inset(0% 0% 0% 0%)"
              : "inset(14% 38% 14% 38%)",
            transition: "clip-path 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-out",
          }}
          aria-hidden="true"
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
      )}
    </div>
  );
}
