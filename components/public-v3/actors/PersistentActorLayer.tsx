"use client";

import { memo } from "react";
import { CinematicActorStage, CINEMATIC_LAYER_Z } from "./CinematicActorStage";

export { CINEMATIC_LAYER_Z };

/** Compatibility name for the single director-owned persistent actor stage. */
export const PersistentActorLayer = memo(function PersistentActorLayer() {
  return <CinematicActorStage />;
});
