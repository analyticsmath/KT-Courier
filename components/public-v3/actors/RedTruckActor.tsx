"use client";

import Image from "next/image";
import { RED_TRUCK_STATES, type RedTruckStateId } from "./actor-state-machine";

interface RedTruckActorProps {
  stateId: RedTruckStateId;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Red Freight Truck Protagonist Actor.
 * High-intensity network actor used selectively for planned heavy freight narrative.
 */
export function RedTruckActor({
  stateId = "centered-hero",
  priority = false,
  className = "",
  style = {},
}: RedTruckActorProps) {
  const actor = RED_TRUCK_STATES[stateId] ?? RED_TRUCK_STATES["centered-hero"];

  return (
    <div
      className={`kt-red-truck-actor select-none pointer-events-none ${className}`}
      data-actor="red-truck"
      data-state={stateId}
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
    >
      <Image
        src={actor.webpSrc}
        alt={actor.alt}
        width={actor.width}
        height={actor.height}
        priority={priority}
        sizes="(max-width: 767px) 94vw, 1500px"
        className="w-full h-auto object-contain"
        style={{
          maxWidth: "100%",
          height: "auto",
          display: "block",
        }}
      />
    </div>
  );
}
