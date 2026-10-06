"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_MAPS_AUTH_FAILURE, loadGoogleBrowserMaps } from "@/lib/maps/google-browser-loader";
import { normalizeGooglePlaceAddress } from "@/lib/maps/address-normalizer";
import type { AddressDto } from "@/lib/maps/google-maps.types";

/** A user-selected location preview. Device location is requested only by its explicit button. */
export function AddressLocationMap({ value, onChange, label }: { value: AddressDto | null; onChange: (value: AddressDto) => void; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const change = useRef(onChange);
  const generation = useRef(0);
  const [status, setStatus] = useState("Loading map…");
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => { change.current = onChange; }, [onChange]);
  useEffect(() => {
    let active = true;
    let click: google.maps.MapsEventListener | undefined;
    const failed = () => { if (active) { setReady(false); setStatus("The map is unavailable. You can still enter your address."); } };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
    void loadGoogleBrowserMaps().then(() => {
      if (!active || !container.current) return;
      map.current = new google.maps.Map(container.current, {
        center: { lat: -26.2041, lng: 28.0473 }, zoom: 10,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        streetViewControl: false, mapTypeControl: false, fullscreenControl: true,
        gestureHandling: "cooperative",
      });
      click = map.current.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) void resolveLocation(event.latLng.toJSON());
      });
      setReady(true);
      setStatus("Choose an address or click the map to set its location.");
    }, failed);
    async function resolveLocation(location: google.maps.LatLngLiteral) {
      const current = ++generation.current;
      setStatus("Confirming selected location…");
      try {
        const result = await new google.maps.Geocoder().geocode({ location });
        if (!active || generation.current !== current) return;
        const address = result.results.find(r => r.address_components.some(c => c.types.includes("country") && c.short_name === "ZA"));
        if (!address) { setStatus("Choose an address in South Africa."); return; }
        const normalized = normalizeGooglePlaceAddress(address);
        // A pin identifies the precise pickup/dropoff point, not the road's reverse-geocoded centre.
        change.current({ ...normalized, latitude: location.lat, longitude: location.lng });
        setStatus("Location selected. Check the street address before saving.");
      } catch { if (active && generation.current === current) setStatus("Could not confirm this location. Try choosing an address."); }
    }
    const locate = (event: Event) => { const detail = (event as CustomEvent<google.maps.LatLngLiteral>).detail; void resolveLocation(detail); };
    const target = container.current;
    target?.addEventListener("kt:location", locate);
    return () => {
      active = false;
      click?.remove();
      target?.removeEventListener("kt:location", locate);
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
      if (marker.current) marker.current.map = null;
      marker.current = null;
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    if (marker.current) marker.current.map = null;
    marker.current = null;
    if (typeof value?.latitude !== "number" || typeof value.longitude !== "number") return;
    const position = { lat: value.latitude, lng: value.longitude };
    marker.current = new google.maps.marker.AdvancedMarkerElement({ map: map.current, position, title: label });
    map.current.panTo(position);
    map.current.setZoom(16);
  }, [ready, value?.latitude, value?.longitude, label]);
  function useMyLocation() {
    if (!navigator.geolocation) { setStatus("Your browser does not support location access."); return; }
    setLocating(true);
    setStatus("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(position => {
      if (!container.current) return;
      setLocating(false);
      container.current?.dispatchEvent(new CustomEvent("kt:location", { detail: { lat: position.coords.latitude, lng: position.coords.longitude } }));
    }, () => { if (!container.current) return; setLocating(false); setStatus("Location access was unavailable. Choose your address on the map."); }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  }
  return <div className="space-y-2">
    <div ref={container} aria-label={`${label} map`} className="h-64 w-full rounded-xl border border-[var(--kt-border)] bg-[var(--kt-cloud-blue)]" />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-xs text-[var(--kt-text-muted)]">{status}</p>
      <button type="button" disabled={!ready || locating} onClick={useMyLocation} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{locating ? "Locating…" : "Use my location"}</button>
    </div>
  </div>;
}
