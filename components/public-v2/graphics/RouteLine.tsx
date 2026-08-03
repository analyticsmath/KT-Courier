import { cn } from "@/lib/utils/cn";
import { RouteCheckpoint } from "./RouteCheckpoint";
import { RouteSegment } from "./RouteSegment";

const routeDefinitions = {
  hero: {
    viewBox: "0 0 750 180",
    path: "M8 149C110 149 137 52 242 52c86 0 113 85 202 85 108 0 127-108 298-108",
    checkpoints: [
      { x: 8, y: 149, kind: "origin" as const },
      { x: 444, y: 137, kind: "intermediate" as const },
      { x: 742, y: 29, kind: "destination" as const },
    ],
  },
  documentary: {
    viewBox: "0 0 460 72",
    path: "M5 55c79 0 83-35 159-35 83 0 80 31 153 31 54 0 80-17 138-42",
    checkpoints: [
      { x: 5, y: 55, kind: "origin" as const },
      { x: 317, y: 51, kind: "intermediate" as const },
      { x: 455, y: 9, kind: "destination" as const },
    ],
  },
  network: {
    viewBox: "0 0 520 94",
    path: "M8 71c87 0 103-45 185-45 78 0 95 47 181 47 47 0 83-18 138-55",
    checkpoints: [
      { x: 8, y: 71, kind: "origin" as const },
      { x: 193, y: 26, kind: "intermediate" as const },
      { x: 512, y: 18, kind: "destination" as const },
    ],
  },
  closing: {
    viewBox: "0 0 440 130",
    path: "M3 107C95 107 78 28 190 28c91 0 101 72 245 72",
    checkpoints: [
      { x: 3, y: 107, kind: "origin" as const },
      { x: 190, y: 28, kind: "intermediate" as const },
      { x: 435, y: 100, kind: "destination" as const },
    ],
  },
} as const;

export type RouteLineProps = {
  variant: keyof typeof routeDefinitions;
  segment: "hero" | "documentary" | "network" | "closing";
  className?: string;
  motionReveal?: "heading" | "media" | "line";
};

/** Decorative narrative geometry; it is never a geographic or operational map. */
export function RouteLine({ variant, segment, className, motionReveal }: RouteLineProps) {
  const definition = routeDefinitions[variant];

  return (
    <svg
      aria-hidden="true"
      className={cn(className)}
      data-kt-motion-layer="route"
      data-kt-motion-reveal={motionReveal}
      data-kt-motion-segment={segment}
      fill="none"
      focusable="false"
      viewBox={definition.viewBox}
    >
      <RouteSegment d={definition.path} />
      {definition.checkpoints.map((checkpoint) => (
        <RouteCheckpoint key={`${checkpoint.x}-${checkpoint.y}`} {...checkpoint} />
      ))}
    </svg>
  );
}
