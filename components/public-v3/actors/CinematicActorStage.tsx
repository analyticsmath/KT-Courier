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

export interface ActorVisibility {
  whiteTruck: boolean;
  van: boolean;
  courier: boolean;
  redTruck: boolean;
}

export interface CinematicActorStageProps {
  whiteTruckState?: WhiteTruckStateId;
  vanState?: VanStateId;
  courierState?: CourierStateId;
  redTruckState?: RedTruckStateId;
  activeActor?: "white-truck" | "van" | "courier" | "red-truck" | null;
  actorVisibility?: Partial<ActorVisibility>;
  whiteTruckStyle?: React.CSSProperties;
  vanStyle?: React.CSSProperties;
  courierStyle?: React.CSSProperties;
  redTruckStyle?: React.CSSProperties;
  isHero?: boolean;
}

/**
 * Authoritative Cinematic Layer Contract:
 * - Environment backdrop:       z-0
 * - Chapter / world media:      z-10
 * - Background typography:      z-15
 * - Persistent actors stage:    z-20 (THIS STAGE)
 * - Physical occluders:         z-25 (Architecture passing in front of actors)
 * - Material takeover:          z-30 (Active trailer/corridor takeover only)
 * - Header / Navigation:        z-50+
 */
export const CINEMATIC_LAYER_Z = {
  environment: 0,
  chapterMedia: 10,
  backgroundType: 15,
  actorsStage: 20,
  physicalOccluders: 25,
  materialTakeover: 30,
  navigation: 50,
} as const;

/**
 * CinematicActorStage — Fixed Viewport Camera Stage.
 * Mounted ONCE in PublicHomeExperience.
 * 
 * CSS Contract:
 * - position: fixed
 * - top: var(--kt-header-height)
 * - left: 0, right: 0, bottom: 0
 * - pointer-events: none
 * - overflow: hidden
 * - z-index: 20
 */
export const CinematicActorStage = memo(function CinematicActorStage({
  whiteTruckState = "wide-hero",
  vanState = "side-left",
  courierState = "look-left-approach",
  redTruckState = "centered-hero",
  activeActor = "white-truck",
  actorVisibility,
  whiteTruckStyle,
  vanStyle,
  courierStyle,
  redTruckStyle,
  isHero = true,
}: CinematicActorStageProps) {
  const isWhiteTruckVisible = actorVisibility?.whiteTruck ?? (activeActor === "white-truck");
  const isVanVisible = actorVisibility?.van ?? (activeActor === "van");
  const isCourierVisible = actorVisibility?.courier ?? (activeActor === "courier");
  const isRedTruckVisible = actorVisibility?.redTruck ?? (activeActor === "red-truck");

  return (
    <div
      className="kt-cinematic-actor-stage pointer-events-none fixed left-0 right-0 bottom-0 overflow-hidden"
      aria-hidden="true"
      style={{
        top: "var(--kt-header-height, 4rem)",
        zIndex: CINEMATIC_LAYER_Z.actorsStage,
      }}
    >
      {/* 1. White Truck Slot (Hero & Route Chapters) */}
      <div
        className={`actor-slot actor-slot-white-truck absolute will-change-transform ${
          isWhiteTruckVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={whiteTruckStyle}
      >
        <WhiteTruckActor
          stateId={whiteTruckState}
          isHero={isHero}
          priority={isHero}
        />
      </div>

      {/* 2. Van Slot (Collection Chapter — Left-Facing) */}
      <div
        className={`actor-slot actor-slot-van absolute will-change-transform ${
          isVanVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={vanStyle}
      >
        <VanActor stateId={vanState} />
      </div>

      {/* 3. Courier Slot (Collection, Custody Split, Arrival Chapters) */}
      <div
        className={`actor-slot actor-slot-courier absolute will-change-transform ${
          isCourierVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={courierStyle}
      >
        <CourierActor stateId={courierState} />
      </div>

      {/* 4. Red Truck Slot (Freight Chapter) */}
      <div
        className={`actor-slot actor-slot-red-truck absolute will-change-transform ${
          isRedTruckVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={redTruckStyle}
      >
        <RedTruckActor stateId={redTruckState} />
      </div>
    </div>
  );
});
