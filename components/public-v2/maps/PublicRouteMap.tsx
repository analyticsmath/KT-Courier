"use client";

import { PublicCoverageMap, type PublicDeliveryRegion } from "./PublicCoverageMap";

interface PublicRouteMapProps {
  regions: readonly PublicDeliveryRegion[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  className?: string;
}

export function PublicRouteMap({
  regions,
  selectedIndex = 0,
  onSelectIndex,
  className = "",
}: PublicRouteMapProps) {
  return (
    <PublicCoverageMap
      className={className}
      interactive={true}
      onSelectIndex={onSelectIndex}
      regions={regions}
      selectedIndex={selectedIndex}
      showBadge={false}
    />
  );
}
