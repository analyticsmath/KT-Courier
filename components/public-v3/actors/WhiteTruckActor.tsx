"use client";

import Image from "next/image";
import { WHITE_TRUCK_STATES, type WhiteTruckStateId } from "./actor-state-machine";

interface WhiteTruckActorProps {
  stateId: WhiteTruckStateId;
  priority?: boolean;
  className?: string;
  isHero?: boolean;
  style?: React.CSSProperties;
}

/**
 * White Truck Protagonist Actor.
 * Enforces authoritative assets and concealment rules.
 * On mobile, the entire vehicle silhouette stays strictly visible within the viewport.
 */
export function WhiteTruckActor({
  stateId = "wide-hero",
  priority = false,
  className = "",
  isHero = false,
  style = {},
}: WhiteTruckActorProps) {
  const actor = WHITE_TRUCK_STATES[stateId] ?? WHITE_TRUCK_STATES["wide-hero"];

  return (
    <div
      className={`kt-white-truck-actor select-none pointer-events-none ${isHero ? "hero-truck-container" : ""} ${className}`}
      data-actor="white-truck"
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
        priority={priority || isHero}
        sizes={
          isHero
            ? "(max-width: 767px) min(92vw, 430px), (max-width: 1440px) 80vw, 1440px"
            : "(max-width: 767px) 100vw, 1440px"
        }
        className={isHero ? "heroTruck" : "w-full h-auto object-contain"}
        style={{
          maxWidth: "100%",
          height: "auto",
          display: "block",
        }}
      />
    </div>
  );
}
