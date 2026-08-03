export type RouteCheckpointProps = {
  x: number;
  y: number;
  kind?: "origin" | "destination" | "intermediate";
};

export function RouteCheckpoint({ x, y, kind = "intermediate" }: RouteCheckpointProps) {
  const radius = kind === "intermediate" ? 3.5 : 5;

  return <circle cx={x} cy={y} data-kt-route-checkpoint={kind} r={radius} />;
}
