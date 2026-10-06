"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GOOGLE_MAPS_AUTH_FAILURE, loadGoogleBrowserMaps } from "@/lib/maps/google-browser-loader";
import { normalizeGooglePlaceAddress } from "@/lib/maps/address-normalizer";
import type { AddressDto } from "@/lib/maps/google-maps.types";

const INITIAL_VIEW = { lat: -26.2041, lng: 28.0473 };
const PIN_HELP = "Drag the pin or click the map, then check the address before saving. The starting pin is only a preview.";

function mappedPosition(value: AddressDto | null): google.maps.LatLngLiteral | null {
  if (!Number.isFinite(value?.latitude) || !Number.isFinite(value?.longitude)) return null;
  return { lat: value!.latitude!, lng: value!.longitude! };
}

function markerPosition(position: google.maps.marker.AdvancedMarkerElement["position"]): google.maps.LatLngLiteral | null {
  if (!position) return null;
  const lat = typeof position.lat === "function" ? position.lat() : position.lat;
  const lng = typeof position.lng === "function" ? position.lng() : position.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** A draft pin is always visible, but never supplies address authority until confirmed. */
export function AddressLocationMap({ value, onChange, label, editRevision = 0 }: { value: AddressDto | null; onChange: (value: AddressDto | null) => void; label: string; editRevision?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const change = useRef(onChange);
  const currentValue = useRef(value);
  const expectedValue = useRef(value);
  const expectedRevision = useRef(editRevision);
  const generation = useRef(0);
  const resolvePin = useRef<(position: google.maps.LatLngLiteral) => Promise<void>>(async () => {});
  const [feedback, setFeedback] = useState({ value, revision: editRevision, text: "Loading map…", confirming: false });
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const currentFeedback = feedback.value === value && feedback.revision === editRevision;
  const confirming = currentFeedback && feedback.confirming;
  const status = currentFeedback ? feedback.text : mappedPosition(value) ? "Location selected. Drag the pin to adjust it." : PIN_HELP;
  function setStatus(text: string) { setFeedback(previous => ({ ...previous, value: expectedValue.current, revision: expectedRevision.current, text })); }
  function setConfirming(pending: boolean) { setFeedback(previous => ({ ...previous, value: expectedValue.current, revision: expectedRevision.current, confirming: pending })); }
  useEffect(() => { change.current = onChange; currentValue.current = value; }, [onChange, value]);
  useEffect(() => {
    // A typed address or Places selection cancels an older reverse-geocode result.
    if (value !== expectedValue.current || editRevision !== expectedRevision.current) {
      generation.current++;
      expectedValue.current = value;
      expectedRevision.current = editRevision;
    }
    if (!ready || !map.current || !marker.current) return;
    marker.current.title = `${label} pin. Drag to choose the exact location.`;
    const position = mappedPosition(value);
    if (position) {
      marker.current.position = position;
      map.current.panTo(position);
      map.current.setZoom(16);
    }
  }, [ready, value, label, editRevision]);
  useEffect(() => {
    let active = true;
    const listeners: google.maps.MapsEventListener[] = [];
    let pin: google.maps.marker.AdvancedMarkerElement | null = null;
    function invalidate() {
      generation.current++;
      expectedValue.current = null;
      change.current(null);
    }
    const failed = () => {
      if (!active) return;
      generation.current++;
      setReady(false);
      setConfirming(false);
      setStatus("The map is unavailable. You can still enter your address.");
    };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
    async function resolveLocation(location: google.maps.LatLngLiteral) {
      if (!active || !map.current || !marker.current) return;
      invalidate();
      const request = generation.current;
      marker.current.position = location;
      map.current.panTo(location);
      setConfirming(true);
      setStatus("Confirming pin location…");
      try {
        const result = await new google.maps.Geocoder().geocode({ location });
        if (!active || generation.current !== request) return;
        const address = result.results.find(r => r.address_components.some(c => c.types.includes("country") && c.short_name === "ZA"));
        if (!address) { setStatus("Choose an address in South Africa. This pin has not been confirmed."); return; }
        const normalized = normalizeGooglePlaceAddress(address);
        if (normalized.line1.trim().length < 3) { setStatus("Choose a location with a street address. This pin has not been confirmed."); return; }
        // The exact user pin wins over the provider's road/building centre.
        const selected = { ...normalized, latitude: location.lat, longitude: location.lng };
        expectedValue.current = selected;
        change.current(selected);
        setStatus("Pin location confirmed. Check the street address before saving.");
      } catch {
        if (active && generation.current === request) setStatus("Could not confirm this pin. Try again or choose an address.");
      } finally {
        if (active && generation.current === request) setConfirming(false);
      }
    }
    resolvePin.current = resolveLocation;
    function dragStart() {
      invalidate();
      setConfirming(false);
      setStatus("Move the pin to your pickup or dropoff point, then release it.");
    }
    function dragEnd() {
      const position = markerPosition(pin?.position);
      if (position) void resolveLocation(position);
    }
    void loadGoogleBrowserMaps().then(() => {
      if (!active || !container.current) return;
      const initial = mappedPosition(currentValue.current);
      map.current = new google.maps.Map(container.current, {
        center: initial || INITIAL_VIEW, zoom: initial ? 16 : 10,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        streetViewControl: false, mapTypeControl: false, fullscreenControl: true,
        gestureHandling: "cooperative",
      });
      pin = new google.maps.marker.AdvancedMarkerElement({
        map: map.current, position: initial || INITIAL_VIEW, gmpDraggable: true,
        title: "Address pin. Drag to choose the exact location.",
      });
      pin.append(new google.maps.marker.PinElement({ background: "#C9362B", borderColor: "#FFFFFF", glyphColor: "#FFFFFF", scale: 1.15 }));
      marker.current = pin;
      pin.addEventListener("gmp-dragstart", dragStart);
      pin.addEventListener("gmp-dragend", dragEnd);
      listeners.push(map.current.addListener("click", (event: google.maps.MapMouseEvent) => {
        // Suppress a clicked POI popup so the user's pin selection remains visible.
        if (event.latLng) { event.stop?.(); void resolveLocation(event.latLng.toJSON()); }
      }));
      setReady(true);
      setStatus(initial ? "Location selected. Drag the pin to adjust it." : PIN_HELP);
    }).catch(failed);
    return () => {
      active = false;
      listeners.forEach(listener => listener.remove());
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
      pin?.removeEventListener("gmp-dragstart", dragStart);
      pin?.removeEventListener("gmp-dragend", dragEnd);
      if (pin) pin.map = null;
      marker.current = null;
      map.current = null;
      resolvePin.current = async () => {};
    };
  }, []);
  function useMyLocation() {
    if (!navigator.geolocation) { setStatus("Your browser does not support location access."); return; }
    generation.current++;
    const request = generation.current;
    expectedValue.current = null;
    change.current(null);
    setLocating(true);
    setStatus("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(position => {
      if (!map.current) return;
      setLocating(false);
      if (generation.current !== request) return;
      void resolvePin.current({ lat: position.coords.latitude, lng: position.coords.longitude });
    }, () => {
      if (!map.current) return;
      setLocating(false);
      if (generation.current !== request) return;
      setStatus("Location access was unavailable. Drag the pin or choose your address.");
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  }
  return <div className="space-y-3">
    <div ref={container} aria-label={`${label} map`} className="h-80 w-full rounded-xl border border-[var(--kt-border)] bg-[var(--kt-cloud-blue)]" />
    <p role="status" className="text-sm text-[var(--kt-text-muted)]">{status}</p>
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="secondary" size="sm" disabled={!ready || confirming || locating} onClick={() => { const position = markerPosition(marker.current?.position); if (position) void resolvePin.current(position); }}>{confirming ? "Confirming pin…" : "Confirm pin location"}</Button>
      <Button type="button" variant="secondary" size="sm" disabled={!ready || confirming || locating} onClick={useMyLocation}>{locating ? "Locating…" : "Use my location"}</Button>
    </div>
    <p className="text-xs text-[var(--kt-text-muted)]">Keyboard: focus the pin, press Alt + Enter (Option + Enter on Mac), move with arrow keys, then press Enter to drop it.</p>
  </div>;
}
