"use client";

import { useState } from "react";
import { DriverSelfDto } from "@/lib/dto/driver.dto";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export function DriverProfileForm({ initialDriver }: { initialDriver: DriverSelfDto }) {
  const [driver, setDriver] = useState(initialDriver);
  const [displayName, setDisplayName] = useState(initialDriver.displayName ?? "");
  const [phone, setPhone] = useState(initialDriver.phone ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(initialDriver.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialDriver.emergencyContactPhone ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/driver/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: displayName || undefined, phone: phone || undefined, emergencyContactName: emergencyContactName || undefined, emergencyContactPhone: emergencyContactPhone || undefined }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Profile changes could not be saved."); return; }
      setDriver(data);
      setMessage("Profile changes have been confirmed.");
    } catch {
      setError("A network error prevented confirmation. Your profile has not been updated in this interface.");
    } finally {
      setLoading(false);
    }
  }

  return <div className={styles.scope}><div className="eo-driver-detail-grid"><OperationalPanel title="Personal contact details" description="Only these driver-owned fields can be changed here. Vehicle, licence, documents, and regions remain source-owned records." padding="spacious"><form className="eo-driver-form" onSubmit={handleSubmit}>{message ? <p className="eo-driver-message eo-driver-message--success" role="status" aria-live="polite">{message}</p> : null}{error ? <p className="eo-driver-message eo-driver-message--error" role="alert" aria-live="assertive">{error}</p> : null}<div className="eo-driver-form-grid"><label htmlFor="driver-display-name">Display name<input id="driver-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label htmlFor="driver-phone">Phone number<input id="driver-phone" required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label htmlFor="driver-emergency-name">Emergency contact name<input id="driver-emergency-name" value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} /></label><label htmlFor="driver-emergency-phone">Emergency contact phone<input id="driver-emergency-phone" type="tel" value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} /></label></div><div className="eo-driver-form-actions"><button disabled={loading} type="submit">{loading ? "Saving changes…" : "Save changes"}</button></div></form></OperationalPanel><div className="space-y-4"><OperationalPanel title="Vehicle and licence" padding="compact"><ul className="eo-driver-context-list"><li>Vehicle: {driver.vehicleMake || driver.vehicleModel ? `${driver.vehicleMake ?? ""} ${driver.vehicleModel ?? ""}`.trim() : "Not assigned"}</li><li>Registration: {driver.vehicleRegistration ?? "Not set"}</li><li>Licence: {driver.licenseNumber ?? "Not set"}</li><li>Licence expiry: {driver.licenseExpiryDate ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(driver.licenseExpiryDate)) : "Not set"}</li></ul></OperationalPanel><OperationalPanel title="Service regions" padding="compact">{driver.serviceRegions.length ? <ul className="eo-driver-context-list">{driver.serviceRegions.map((region) => <li key={region.regionId}>{region.name}{region.isPrimary ? " · primary" : ""}</li>)}</ul> : <p className="text-sm text-[var(--eo-text-secondary)]">No service regions are assigned.</p>}</OperationalPanel></div></div></div>;
}
