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
  whiteTruckState?: WhiteTruckStateId | null;
  vanState?: VanStateId | null;
  courierState?: CourierStateId | null;
  redTruckState?: RedTruckStateId | null;
  activeActor?: "white-truck" | "van" | "courier" | "red-truck" | null;
  whiteTruckStyle?: React.CSSProperties;
  vanStyle?: React.CSSProperties;
  courierStyle?: React.CSSProperties;
  redTruckStyle?: React.CSSProperties;
  isHero?: boolean;
}

/**
 * Persistent Actor Layer.
 * Survives across cinematic chapters, managing active actors without destroying/recreating
 * separate image elements per section.
 */
export const PersistentActorLayer = memo(function PersistentActorLayer({
  whiteTruckState,
  vanState,
  courierState,
  redTruckState,
  activeActor = "white-truck",
  whiteTruckStyle,
  vanStyle,
  courierStyle,
  redTruckStyle,
  isHero = false,
}: PersistentActorLayerProps) {
  return (
    <div
      className="kt-persistent-actor-layer pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {whiteTruckState && (
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
      )}

      {vanState && (
        <div
          className={`actor-slot actor-slot-van absolute transition-opacity duration-300 ${
            activeActor === "van" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={vanStyle}
        >
          <VanActor stateId={vanState} />
        </div>
      )}

      {courierState && (
        <div
          className={`actor-slot actor-slot-courier absolute transition-opacity duration-300 ${
            activeActor === "courier" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={courierStyle}
        >
          <CourierActor stateId={courierState} />
        </div>
      )}

      {redTruckState && (
        <div
          className={`actor-slot actor-slot-red-truck absolute transition-opacity duration-300 ${
            activeActor === "red-truck" ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={redTruckStyle}
        >
          <RedTruckActor stateId={redTruckState} />
        </div>
      )}
    </div>
  );
});
