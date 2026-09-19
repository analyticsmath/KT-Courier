"use client";

import Image from "next/image";
import { VAN_STATES, VAN_DOOR_CALIBRATION, type VanStateId } from "./actor-state-machine";

interface VanActorProps {
  stateId?: VanStateId;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Van Protagonist Actor.
 * Used for collection sequences and street movement.
 * Enforces the coherent LEFT-FACING collection family:
 * motion-transition (#13) -> side-left (#02) -> sliding-door-open (#10).
 * Door aperture is mathematically calibrated from pixel differences between #02 and #10 masters.
 */
export function VanActor({
  stateId = "side-left",
  priority = false,
  className = "",
  style = {},
}: VanActorProps) {
  // Collection sequence uses side-left as the base closed profile
  const isLeftCollectionDoorSequence = stateId === "side-left" || stateId === "sliding-door-open";
  const isDoorOpen = stateId === "sliding-door-open";

  const baseActor = isLeftCollectionDoorSequence
    ? VAN_STATES["side-left"]
    : (VAN_STATES[stateId] ?? VAN_STATES["side-left"]);

  const doorOpenActor = VAN_STATES["sliding-door-open"];

  return (
    <div
      className={`kt-van-actor select-none pointer-events-none ${className}`}
      data-actor="van"
      data-state={stateId}
      data-ground-contact-x={baseActor.groundContact.x}
      data-ground-contact-y={baseActor.groundContact.y}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      {/* Base van silhouette (closed side-left profile or active state) */}
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

      {/* Calibrated Door Aperture: Opens over base side-left silhouette */}
      {isLeftCollectionDoorSequence && (
        <div
          className="van-door-boundary pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            clipPath: VAN_DOOR_CALIBRATION.clipPathInset,
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
