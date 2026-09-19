"use client";

import { memo } from "react";
import { WhiteTruckActor } from "./WhiteTruckActor";
import { VanActor } from "./VanActor";
import { CourierActor } from "./CourierActor";
import { RedTruckActor } from "./RedTruckActor";
import type {
  WhiteTruckStateId,
  VanStateId,
  CourierStateId,
  RedTruckStateId,
} from "./actor-state-machine";

export interface PersistentActorLayerProps {
  whiteTruckState?: WhiteTruckStateId;
  vanState?: VanStateId;
  courierState?: CourierStateId;
  redTruckState?: RedTruckStateId;
  activeActor?: "white-truck" | "van" | "courier" | "red-truck" | null;
  whiteTruckStyle?: React.CSSProperties;
  vanStyle?: React.CSSProperties;
  courierStyle?: React.CSSProperties;
  redTruckStyle?: React.CSSProperties;
  isHero?: boolean;
}

/**
 * Persistent Actor Layer.
 * Mounted ONCE at root level in PublicHomeExperience.
 * The four actor components remain mounted for the entire session without re-parenting.
 * Discrete narrative-state changes are handled via props, while GSAP continuously
 * translates their slot elements toward measured scene anchor targets.
 */
export const PersistentActorLayer = memo(function PersistentActorLayer({
  whiteTruckState = "wide-hero",
  vanState = "side-right",
  courierState = "look-right-approach",
  redTruckState = "centered-hero",
  activeActor = "white-truck",
  whiteTruckStyle,
  vanStyle,
  courierStyle,
  redTruckStyle,
  isHero = true,
}: PersistentActorLayerProps) {
  return (
    <div
      className="kt-persistent-actor-layer pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Persistent White Truck Actor (Hero & Route Chapters) */}
      <div
        className={`actor-slot actor-slot-white-truck absolute transition-opacity duration-300 ${
          activeActor === "white-truck" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={whiteTruckStyle}
      >
        <WhiteTruckActor
          stateId={whiteTruckState}
          isHero={isHero}
          priority={isHero}
        />
      </div>

      {/* 2. Persistent Van Actor (Collection Chapter) */}
      <div
        className={`actor-slot actor-slot-van absolute transition-opacity duration-300 ${
          activeActor === "van" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={vanStyle}
      >
        <VanActor stateId={vanState} />
      </div>

      {/* 3. Persistent Courier Actor (Collection, Custody Split, Arrival Chapters) */}
      <div
        className={`actor-slot actor-slot-courier absolute transition-opacity duration-300 ${
          activeActor === "courier" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={courierStyle}
      >
        <CourierActor stateId={courierState} />
      </div>

      {/* 4. Persistent Red Truck Actor (Freight Chapter) */}
      <div
        className={`actor-slot actor-slot-red-truck absolute transition-opacity duration-300 ${
          activeActor === "red-truck" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={redTruckStyle}
      >
        <RedTruckActor stateId={redTruckState} />
      </div>
    </div>
  );
});
