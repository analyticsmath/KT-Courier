"use client";

import { useState } from "react";
import { DriverSelfDto } from "@/lib/dto/driver.dto";
import { DriverAvailability, DriverStatus } from "@/types/db";
import { DRIVER_AVAILABILITY_LABELS } from "@/lib/constants/drivers";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export function DriverAvailabilityToggle({ initialDriver }: { initialDriver: DriverSelfDto }) {
  const [availability, setAvailability] = useState<DriverAvailability>(initialDriver.availability);
  const [revision, setRevision] = useState(initialDriver.availabilityRevision);
  const [loading, setLoading] = useState<DriverAvailability | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const canChoose = initialDriver.status === DriverStatus.ACTIVE;

  async function updateAvailability(nextAvailability: DriverAvailability) {
    if (!canChoose) {
      setError("Only an active driver account can change availability.");
      return;
    }
    if (nextAvailability === availability || loading) return;
    setSuccess("");
    setError("");
    setLoading(nextAvailability);
    try {
      const response = await fetch("/api/driver/availability", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ availability: nextAvailability, expectedRevision: revision }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Availability could not be updated. Refresh the page and try again.");
        return;
      }
      setAvailability(data.availability);
      setRevision(data.availabilityRevision);
      setSuccess(`Availability confirmed as ${DRIVER_AVAILABILITY_LABELS[data.availability as DriverAvailability]}.`);
    } catch {
      setError("A network error prevented confirmation. Your availability has not been changed in this interface.");
    } finally {
      setLoading(null);
    }
  }

  const options: readonly { value: DriverAvailability; label: string; description: string }[] = [
    { value: "AVAILABLE", label: "Available", description: "Ready to receive dispatch." },
    { value: "UNAVAILABLE", label: "Unavailable", description: "Do not receive dispatch for now." },
    { value: "OFFLINE", label: "Offline", description: "Off duty." },
  ];

  return <div className={styles.scope}><OperationalPanel title="Availability" description="This is an operational status, not a preference. The change is sent to and confirmed by the server." padding="spacious">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-[var(--eo-text-secondary)]">Current availability</p><ProtectedStatus label={DRIVER_AVAILABILITY_LABELS[availability]} tone={availability === "AVAILABLE" ? "success" : availability === "ON_DELIVERY" ? "information" : "neutral"} /></div>
    {!canChoose ? <p className="eo-driver-message eo-driver-message--error" role="alert">Your account is not active, so availability cannot be changed.</p> : null}
    {success ? <p className="eo-driver-message eo-driver-message--success" role="status" aria-live="polite">{success}</p> : null}
    {error ? <p className="eo-driver-message eo-driver-message--error" role="alert" aria-live="assertive">{error}</p> : null}
    <div className="eo-driver-availability-options" aria-label="Availability choices">{options.map((option) => <button key={option.value} aria-pressed={availability === option.value} className="eo-driver-availability-option" disabled={!canChoose || loading !== null} onClick={() => updateAvailability(option.value)} type="button"><strong>{loading === option.value ? `Setting ${option.label}…` : option.label}</strong><span>{option.description}</span></button>)}</div>
    <p className="eo-driver-message">The server validates active-account eligibility, current availability revision, and the requested state. A failed request leaves the displayed confirmed state unchanged.</p>
  </OperationalPanel></div>;
}
