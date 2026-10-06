"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_MAPS_AUTH_FAILURE, loadGoogleBrowserMaps } from "@/lib/maps/google-browser-loader";
import { trackingMapPoints, type TrackingMapPoint } from "@/lib/maps/tracking-map-presentation";

export function CourierTrackingMap({ reference, scope }: { reference: string; scope: "MARKETPLACE" | "PARCEL" }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [ready, setReady] = useState(false);
  const [points, setPoints] = useState<TrackingMapPoint[]>([]);
  const [status, setStatus] = useState("Checking the latest delivery location…");
  const keyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

  useEffect(() => {
    if (!keyConfigured) return;
    let active = true;
    const failed = () => { if (active) { setReady(false); setStatus("The map is temporarily unavailable."); } };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
    void loadGoogleBrowserMaps().then(() => {
      if (!active || !container.current) return;
      map.current = new google.maps.Map(container.current, { center: { lat: -26.2041, lng: 28.0473 }, zoom: 10, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID", mapTypeControl: false, streetViewControl: false, gestureHandling: "cooperative" });
      setReady(true);
    }, failed);
    return () => { active = false; window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed); markers.current.forEach(marker => { marker.map = null; }); markers.current = []; map.current = null; };
  }, [keyConfigured]);

  useEffect(() => {
    if (!keyConfigured) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const endpoint = scope === "MARKETPLACE" ? `/api/marketplace-orders/${encodeURIComponent(reference)}/tracking` : `/api/tracking/orders/${encodeURIComponent(reference)}/location`;
    async function refresh() {
      try {
        if (document.visibilityState === "hidden") return;
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) stopped = true;
          throw Error("Location is not available at this stage.");
        }
        const next = trackingMapPoints(await response.json(), scope, reference);
        if (controller.signal.aborted) return;
        setPoints(next);
        setStatus(next.length ? "Courier’s last reported location. Updates every 30 seconds while this page is open." : "Courier location is not available at this stage.");
      } catch {
        if (!controller.signal.aborted) { setPoints([]); setStatus("Courier location is unavailable. Check your delivery status for updates."); }
      } finally { if (!controller.signal.aborted && !stopped) timer = setTimeout(() => { void refresh(); }, 30_000); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [keyConfigured, reference, scope]);

  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach(marker => { marker.map = null; });
    markers.current = points.map(point => new google.maps.marker.AdvancedMarkerElement({ map: map.current, position: { lat: point.latitude, lng: point.longitude }, title: `${point.label} courier — last reported location` }));
    if (points.length === 1) { map.current.panTo({ lat: points[0]!.latitude, lng: points[0]!.longitude }); map.current.setZoom(13); }
    else if (points.length > 1) { const bounds = new google.maps.LatLngBounds(); points.forEach(point => bounds.extend({ lat: point.latitude, lng: point.longitude })); map.current.fitBounds(bounds, 48); }
  }, [ready, points]);

  if (!keyConfigured) return <p role="status" className="text-sm text-[var(--kt-text-muted)]">The delivery map is temporarily unavailable. Your order status remains available.</p>;
  return <div className="space-y-3">
    <div ref={container} aria-label="Delivery tracking map" className="h-72 w-full rounded-xl border bg-[var(--kt-cloud-blue)]" />
    <p role="status" className="text-sm text-[var(--kt-text-muted)]">{status}</p>
    {points.length > 0 && <ul className="space-y-1 text-xs">{points.map(point => <li key={point.id}>{point.label}: last report {new Date(point.observedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}. Location is approximate.</li>)}</ul>}
  </div>;
}
