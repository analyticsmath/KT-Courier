"use client";

import { memo } from "react";
import {
  CinematicActorStage,
  type CinematicActorStageProps,
  type ActorVisibility,
  CINEMATIC_LAYER_Z,
} from "./CinematicActorStage";

export type { ActorVisibility, CinematicActorStageProps as PersistentActorLayerProps };
export { CINEMATIC_LAYER_Z };

/**
 * Persistent Actor Layer (alias for CinematicActorStage).
 * Preserves backward compatibility while implementing the fixed camera stage contract.
 */
export const PersistentActorLayer = memo(function PersistentActorLayer(
  props: CinematicActorStageProps
) {
  return <CinematicActorStage {...props} />;
});
