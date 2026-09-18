"use client";

import Image from "next/image";
import { COURIER_STATES, type CourierStateId } from "./actor-state-machine";

interface CourierActorProps {
  stateId: CourierStateId;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Courier Protagonist Actor.
 * Enforces direction and eyeline matching vehicle and delivery orientation.
 */
export function CourierActor({
  stateId = "look-right-approach",
  priority = false,
  className = "",
  style = {},
}: CourierActorProps) {
  const actor = COURIER_STATES[stateId] ?? COURIER_STATES["look-right-approach"];

  return (
    <div
      className={`kt-courier-actor select-none pointer-events-none ${className}`}
      data-actor="courier"
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
        sizes="(max-width: 767px) 70vw, 600px"
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
