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
  const actor = VAN_STATES[stateId] ?? VAN_STATES["side-right"];

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
      <Image
        src={actor.webpSrc}
        alt={actor.alt}
        width={actor.width}
        height={actor.height}
        priority={priority}
        sizes="(max-width: 767px) 90vw, 1200px"
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
