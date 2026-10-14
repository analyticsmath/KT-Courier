"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const MIN_REPORT_INTERVAL_MS = 25_000;

/**
 * Foreground-only, driver-consented GPS streaming. Never fetches an external
 * destination or saves precise coordinates in client storage.
 * Canonical assignment ownership, plausibility and terminal-order controls
 * remain enforced by the location-evidence endpoint.
 */
export function DriverLiveLocationSharing({
  assignmentId,
  assignmentVersion,
}: {
  assignmentId: string;
  assignmentVersion: number;
}) {
  const watchId = useRef<number | null>(null);
  const inFlight = useRef(false);
  const lastSent = useRef(0);
  const alive = useRef(true);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState("Live location is off.");

  const stopSharing = useCallback((message: string) => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    setStatus(message);
  }, []);

  useEffect(() => {
    alive.current = true;
    const stopOnHidden = () => {
      if (document.visibilityState === "hidden" && watchId.current !== null) {
        stopSharing("Location sharing paused because this delivery page is no longer visible.");
      }
    };
    document.addEventListener("visibilitychange", stopOnHidden);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", stopOnHidden);
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [assignmentId, assignmentVersion, stopSharing]);

  async function submitPosition(position: GeolocationPosition) {
    if (!alive.current || watchId.current === null || document.visibilityState !== "visible" || inFlight.current) return;
    const now = Date.now();
    if (now - lastSent.current < MIN_REPORT_INTERVAL_MS) return;
    lastSent.current = now;
    inFlight.current = true;
    const capturedAt = new Date(position.timestamp).toISOString();
    try {
      const response = await fetch(`/api/driver/assignments/${encodeURIComponent(assignmentId)}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: `driver-gps-${crypto.randomUUID()}`,
          assignmentVersion,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          clientCapturedAt: capturedAt,
          accuracyMeters: position.coords.accuracy,
          headingDegrees: position.coords.heading ?? undefined,
          speedMetersPerSecond: position.coords.speed ?? undefined,
          source: "DEVICE_GPS",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!alive.current || watchId.current === null) return;
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) {
          stopSharing("Location sharing stopped: your assignment or session changed. Refresh the delivery before restarting.");
          return;
        }
        setStatus("Location update failed; keeping sharing active while this page is open.");
        return;
      }
      const accepted = result.validationStatus === "ACCEPTED";
      setStatus(accepted
        ? `Verified location shared at ${new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}.`
        : "The last GPS point needs verification; use Record Location near the destination.");
    } catch {
      if (alive.current && watchId.current !== null) setStatus("Network unavailable. Sharing will retry on the next GPS update.");
    } finally {
      inFlight.current = false;
    }
  }

  function startSharing() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatus("Live location requires an HTTPS connection and a device with GPS/location permission.");
      return;
    }
    if (watchId.current !== null) return;
    setStatus("Requesting location permission…");
    lastSent.current = 0;
    const id = navigator.geolocation.watchPosition(
      position => { void submitPosition(position); },
      error => {
        stopSharing(error.code === 1
          ? "Location permission was denied. Enable it in your browser settings to share GPS."
          : "Device location is unavailable. Sharing stopped; use Record Location when GPS is available.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    watchId.current = id;
    setSharing(true);
  }

  return <div className="space-y-2 rounded-xl border border-[var(--kt-soft-border)] p-3" aria-label="Live delivery location sharing">
    <p className="text-sm font-semibold">Live delivery location</p>
    <p className="text-xs text-[var(--kt-text-muted)]">
      Share verified GPS updates while this delivery page stays open and visible.
      Customers see only approximate location while the delivery is in progress.
      Sharing stops when you turn it off, close the page, or leave the tab.
      Background tracking is not supported by the web browser.
    </p>
    <Button type="button" variant={sharing ? "secondary" : "primary"}
      onClick={sharing ? () => stopSharing("Live location is off.") : startSharing}>
      {sharing ? "Stop live sharing" : "Start live sharing"}
    </Button>
    <p role="status" aria-live="polite" className="text-xs text-[var(--kt-text-muted)]">{status}</p>
  </div>;
}
