export type RouteSegmentProps = {
  d: string;
};

export function RouteSegment({ d }: RouteSegmentProps) {
  return <path d={d} data-kt-route-path="true" pathLength="1" />;
}
