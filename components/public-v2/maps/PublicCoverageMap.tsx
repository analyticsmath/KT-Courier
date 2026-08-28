"use client";

import { useEffect, useRef, useState } from "react";
import { loadPublicGoogleMaps, isGoogleMapsLoaded } from "./google-public-loader";
import styles from "./public-maps.module.css";

export interface PublicDeliveryRegion {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  city?: string | null;
  province?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  coverageRadiusKm?: number | null;
  maxDistanceKm?: number | null;
  active?: boolean;
}

interface PublicCoverageMapProps {
  regions: readonly PublicDeliveryRegion[];
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  interactive?: boolean;
  className?: string;
  showBadge?: boolean;
}

// Restrained silver/carbon map style
const KT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f6f6" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#303532" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7d8581" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#e6e9e8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dde1e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c2c7c5" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#dde1e0" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7d8581" }],
  },
];

export function PublicCoverageMap({
  regions,
  selectedIndex = 0,
  onSelectIndex,
  interactive = false,
  className = "",
  showBadge = true,
}: PublicCoverageMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(
    () => !process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
  );

  const validRegions = regions.filter(
    (r) => typeof r.centerLat === "number" && typeof r.centerLng === "number"
  );

  // Initialize Map
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
      return;
    }

    const initMap = () => {
      if (!mapContainerRef.current || typeof google === "undefined") return;

      const defaultCenter =
        validRegions.length > 0 && validRegions[0].centerLat && validRegions[0].centerLng
          ? { lat: validRegions[0].centerLat, lng: validRegions[0].centerLng }
          : { lat: -26.2041, lng: 28.0473 }; // Johannesburg default center

      const map = new google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 11,
        styles: KT_MAP_STYLES,
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: interactive,
        gestureHandling: interactive ? "auto" : "none",
        backgroundColor: "#eceeee",
      });

      mapInstanceRef.current = map;
      setMapReady(true);
    };

    if (isGoogleMapsLoaded()) {
      initMap();
    } else {
      loadPublicGoogleMaps(initMap, () => setLoadFailed(true));
    }
  }, [interactive, validRegions]);

  // Update Markers & Circles when map is ready or selectedIndex changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof google === "undefined") return;
    const map = mapInstanceRef.current;

    // Clear existing
    markersRef.current.forEach((m) => m.setMap(null));
    circlesRef.current.forEach((c) => c.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];

    if (validRegions.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    validRegions.forEach((region, idx) => {
      const pos = { lat: region.centerLat!, lng: region.centerLng! };
      bounds.extend(pos);

      const isSelected = idx === selectedIndex;

      // Marker
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: region.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 8 : 5,
          fillColor: isSelected ? "#D83A2E" : "#303532",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });

      if (interactive && onSelectIndex) {
        marker.addListener("click", () => {
          onSelectIndex(idx);
        });
      }

      markersRef.current.push(marker);

      // Radius circle
      if (region.coverageRadiusKm) {
        const circle = new google.maps.Circle({
          map,
          center: pos,
          radius: region.coverageRadiusKm * 1000,
          fillColor: isSelected ? "#D83A2E" : "#101210",
          fillOpacity: isSelected ? 0.12 : 0.04,
          strokeColor: isSelected ? "#D83A2E" : "#7D8581",
          strokeOpacity: isSelected ? 0.6 : 0.25,
          strokeWeight: isSelected ? 1.5 : 1,
        });
        circlesRef.current.push(circle);
      }
    });

    // Center on selected region or fit bounds
    const activeRegion = validRegions[selectedIndex] ?? validRegions[0];
    if (activeRegion && activeRegion.centerLat && activeRegion.centerLng) {
      map.panTo({ lat: activeRegion.centerLat, lng: activeRegion.centerLng });
      map.setZoom(11);
    } else if (validRegions.length > 1) {
      map.fitBounds(bounds, 40);
    }
  }, [mapReady, selectedIndex, validRegions, interactive, onSelectIndex]);

  if (loadFailed || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    const activeRegion = regions[selectedIndex] ?? regions[0];
    return (
      <div className={`${styles.mapContainer} ${className}`} role="region" aria-label="Coverage Area Overview">
        {showBadge && <div className={styles.mapOverlayBadge}>Coverage Network</div>}
        <div className={styles.mapFallback}>
          <div className={styles.mapFallbackHeader}>
            <span className={styles.mapFallbackTitle}>Configured Delivery Regions</span>
            <p className={styles.mapFallbackSub}>
              Courier serviceability is verified through actual pickup and delivery coordinates.
            </p>
          </div>

          <ul className={styles.regionCoordsList}>
            {regions.slice(0, 6).map((region, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  className={styles.regionCoordItem}
                  key={region.name}
                  onClick={() => onSelectIndex?.(idx)}
                  style={{ cursor: onSelectIndex ? "pointer" : "default" }}
                >
                  <span className={isSelected ? styles.regionActiveName : styles.regionName}>
                    {region.name}
                  </span>
                  {typeof region.centerLat === "number" && typeof region.centerLng === "number" ? (
                    <span className={styles.regionCoordValues}>
                      {region.centerLat.toFixed(4)}°S, {region.centerLng.toFixed(4)}°E
                    </span>
                  ) : (
                    <span className={styles.regionCoordValues}>
                      {[region.city, region.province].filter(Boolean).join(", ") || "Active Region"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={styles.mapFallbackFooter}>
            <span>{activeRegion ? `Active: ${activeRegion.name}` : "Verified delivery areas"}</span>
            <span>South Africa</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.mapContainer} ${className}`} role="region" aria-label="Interactive Coverage Map">
      {showBadge && <div className={styles.mapOverlayBadge}>Delivery Geography</div>}
      <div className={styles.mapCanvas} ref={mapContainerRef} />
    </div>
  );
}
