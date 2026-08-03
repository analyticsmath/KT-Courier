"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/types/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { DriverDetailDto } from "@/lib/dto/driver.dto";
import { DRIVER_STATUS_LABELS, DRIVER_AVAILABILITY_LABELS } from "@/lib/constants/drivers";
import { DriverStatus, DriverAvailability } from "@/types/db";

interface Region {
  id: string;
  name: string;
  slug: string;
}

interface ActivityLog {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  actorUser: {
    email: string;
    name: string | null;
  } | null;
}

interface DriverDetailsConsoleProps {
  initialDriver: DriverDetailDto;
  allRegions: Region[];
  activityLogs: ActivityLog[];
}

export function DriverDetailsConsole({
  initialDriver,
  allRegions,
  activityLogs,
}: DriverDetailsConsoleProps) {
  const [driver, setDriver] = useState<DriverDetailDto>(initialDriver);
  const [logs, setLogs] = useState<ActivityLog[]>(activityLogs);

  // Status transitions state
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  // Vehicle info state
  const [vehicleType, setVehicleType] = useState<string>(driver.vehicleType || "");
  const [vehicleMake, setVehicleMake] = useState(driver.vehicleMake || "");
  const [vehicleModel, setVehicleModel] = useState(driver.vehicleModel || "");
  const [vehicleColor, setVehicleColor] = useState(driver.vehicleColor || "");
  const [vehicleRegistration, setVehicleRegistration] = useState(driver.vehicleRegistration || "");
  const [licenseNumber, setLicenseNumber] = useState(driver.licenseNumber || "");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(
    driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate).toISOString().split("T")[0] : ""
  );
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleSuccess, setVehicleSuccess] = useState("");
  const [vehicleError, setVehicleError] = useState("");

  // Notes state
  const [serviceNotes, setServiceNotes] = useState(driver.serviceNotes || "");
  const [internalNotes, setInternalNotes] = useState(driver.internalNotes || "");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState("");

  // Regions state
  const [assignedRegionIds, setAssignedRegionIds] = useState<string[]>(
    driver.serviceRegions.map((r) => r.regionId)
  );
  const [primaryRegionId, setPrimaryRegionId] = useState<string>(
    driver.serviceRegions.find((r) => r.isPrimary)?.regionId || ""
  );
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsSuccess, setRegionsSuccess] = useState("");
  const [regionsError, setRegionsError] = useState("");

  // Re-fetch details to sync view
  const refreshDetails = async () => {
    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`);
      if (res.ok) {
        const data = await res.json();
        setDriver(data);
        setVehicleType(data.vehicleType || "");
        setVehicleMake(data.vehicleMake || "");
        setVehicleModel(data.vehicleModel || "");
        setVehicleColor(data.vehicleColor || "");
        setVehicleRegistration(data.vehicleRegistration || "");
        setLicenseNumber(data.licenseNumber || "");
        setLicenseExpiryDate(
          data.licenseExpiryDate ? new Date(data.licenseExpiryDate).toISOString().split("T")[0] : ""
        );
        setServiceNotes(data.serviceNotes || "");
        setInternalNotes(data.internalNotes || "");
        setAssignedRegionIds(data.serviceRegions.map((r: { regionId: string }) => r.regionId));
        setPrimaryRegionId(data.serviceRegions.find((r: { isPrimary: boolean }) => r.isPrimary)?.regionId || "");
      }

      // Also refresh logs
      // Note: For simplicity we append local logs or refresh from page reload, let's keep logs in local state for this UI
    } catch (err) {
      console.error("Failed to refresh details:", err);
    }
  };

  // Status transitions API call
  const handleStatusTransition = async (newStatus: DriverStatus) => {
    setStatusError("");
    
    // Validate reasons
    if ((newStatus === "REJECTED" || newStatus === "SUSPENDED") && (!statusReason || statusReason.trim().length < 3)) {
      setStatusError("A valid reason (at least 3 characters) is required.");
      return;
    }

    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: statusReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transition failed.");
      
      setStatusReason("");
      // Add local log mock-up to logs list
      const newLog: ActivityLog = {
        id: Math.random().toString(),
        action: "STATUS_CHANGE",
        message: `Driver status changed to ${newStatus}${statusReason ? ` (Reason: ${statusReason})` : ""}`,
        createdAt: new Date().toISOString(),
        actorUser: { name: "You (Admin)", email: "" },
      };
      setLogs([newLog, ...logs]);
      
      await refreshDetails();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setStatusError(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  // Force Availability API call
  const handleForceAvailability = async (availability: DriverAvailability) => {
    setStatusError("");
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Availability update failed.");

      const newLog: ActivityLog = {
        id: Math.random().toString(),
        action: "UPDATE",
        message: `Driver availability forced by admin to ${availability}`,
        createdAt: new Date().toISOString(),
        actorUser: { name: "You (Admin)", email: "" },
      };
      setLogs([newLog, ...logs]);

      await refreshDetails();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setStatusError(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  // Vehicle info save
  const handleSaveVehicleInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleSuccess("");
    setVehicleError("");
    setVehicleLoading(true);

    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleType: vehicleType || undefined,
          vehicleMake: vehicleMake || undefined,
          vehicleModel: vehicleModel || undefined,
          vehicleColor: vehicleColor || undefined,
          vehicleRegistration: vehicleRegistration || undefined,
          licenseNumber: licenseNumber || undefined,
          licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");

      setVehicleSuccess("Vehicle information updated successfully.");
      await refreshDetails();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setVehicleError(msg);
    } finally {
      setVehicleLoading(false);
    }
  };

  // Regions save
  const handleSaveRegions = async () => {
    setRegionsSuccess("");
    setRegionsError("");
    setRegionsLoading(true);

    try {
      // Validate primary region selection if regions are assigned
      if (assignedRegionIds.length > 0 && primaryRegionId && !assignedRegionIds.includes(primaryRegionId)) {
        throw new Error("Primary region must be one of the assigned service regions.");
      }

      const res = await fetch(`/api/admin/drivers/${driver.id}/regions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionIds: assignedRegionIds,
          primaryRegionId: primaryRegionId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update coverage regions.");

      setRegionsSuccess("Service regions updated successfully.");
      await refreshDetails();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setRegionsError(msg);
    } finally {
      setRegionsLoading(false);
    }
  };

  // Notes save
  const handleSaveNotes = async () => {
    setNotesSuccess("");
    setNotesLoading(true);

    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceNotes,
          internalNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update notes failed.");

      setNotesSuccess("Notes saved successfully.");
      await refreshDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setNotesLoading(false);
    }
  };

  // Region checkbox change handler
  const handleRegionCheckboxChange = (rId: string, checked: boolean) => {
    if (checked) {
      setAssignedRegionIds([...assignedRegionIds, rId]);
      // Auto-set primary if none selected
      if (!primaryRegionId) {
        setPrimaryRegionId(rId);
      }
    } else {
      setAssignedRegionIds(assignedRegionIds.filter((id) => id !== rId));
      if (primaryRegionId === rId) {
        setPrimaryRegionId("");
      }
    }
  };

  // Badge variants
  const getStatusBadgeVariant = (status: DriverStatus): BadgeVariant => {
    switch (status) {
      case "ACTIVE": return "green";
      case "PENDING_REVIEW": return "amber";
      case "SUSPENDED": return "red";
      case "REJECTED": return "red";
      case "INACTIVE":
      default: return "gray";
    }
  };

  const getAvailabilityBadgeVariant = (availability: DriverAvailability): BadgeVariant => {
    switch (availability) {
      case "AVAILABLE": return "green";
      case "ON_DELIVERY": return "blue";
      case "UNAVAILABLE": return "amber";
      case "OFFLINE":
      default: return "gray";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LEFT COLUMN: Identity, Status, Notes */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Identity & Status */}
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--kt-cool-gray)] text-[var(--kt-ink-navy)] rounded-lg">
                  {driver.driverCode}
                </span>
                <h2 className="text-xl font-bold text-[var(--kt-ink-navy)] mt-2">
                  {driver.displayName || "No Display Name"}
                </h2>
                <p className="text-sm text-[var(--kt-text-muted)]">{driver.user.email}</p>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <Badge variant={getStatusBadgeVariant(driver.status)}>
                  {DRIVER_STATUS_LABELS[driver.status]}
                </Badge>
                <Badge variant={getAvailabilityBadgeVariant(driver.availability)}>
                  {DRIVER_AVAILABILITY_LABELS[driver.availability]}
                </Badge>
              </div>
            </div>

            <div className="border-t border-[var(--kt-soft-border)] pt-3 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--kt-text-muted)] font-medium">Phone:</span>
                <span className="font-semibold text-[var(--kt-ink-navy)] tabular-nums">{driver.phone || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--kt-text-muted)] font-medium">Joined:</span>
                <span className="font-semibold text-[var(--kt-ink-navy)]">
                  {new Date(driver.createdAt).toLocaleDateString("en-ZA")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--kt-text-muted)] font-medium">Onboarding:</span>
                <span className="font-semibold text-[var(--kt-ink-navy)] capitalize">
                  {driver.onboardingStatus.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Emergency Contacts */}
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Emergency Contact
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="block text-xs text-[var(--kt-text-muted)] font-medium mb-0.5">Name</span>
                <span className="font-semibold text-[var(--kt-ink-navy)]">{driver.emergencyContactName || "Not set"}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--kt-text-muted)] font-medium mb-0.5">Phone Number</span>
                <span className="font-semibold text-[var(--kt-ink-navy)] tabular-nums">{driver.emergencyContactPhone || "Not set"}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Notes Panel */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Notes
            </h3>

            {notesSuccess && (
              <div className="text-xs text-[var(--kt-teal-emerald)] font-bold bg-[var(--kt-mint-wash)] p-2.5 rounded-xl border border-[var(--kt-teal-emerald)]">
                {notesSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="srvNotes">Service Notes (Driver-Facing)</Label>
                <textarea
                  id="srvNotes"
                  className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] p-2.5 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)] h-20 resize-none"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Notes about operational instructions, routes, driver rules..."
                />
              </div>

              <div>
                <Label htmlFor="intNotes">Internal Admin Notes (Private)</Label>
                <textarea
                  id="intNotes"
                  className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] p-2.5 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)] h-20 resize-none"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Private notes about issues, records, admin remarks..."
                />
              </div>

              <Button onClick={handleSaveNotes} variant="secondary" size="sm" fullWidth loading={notesLoading} disabled={notesLoading}>
                Save Notes
              </Button>
            </div>
          </div>
        </Card>

      </div>

      {/* MIDDLE COLUMN: Controls, Regions, Work Shell */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Admin Control Console */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border(--kt-soft-border) pb-1.5">
              Admin Control Console
            </h3>

            {statusError && (
              <div role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)]">
                {statusError}
              </div>
            )}

            {/* Actions list */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="statReason">Reason for Suspension / Rejection</Label>
                <Input
                  id="statReason"
                  placeholder="Required for Suspend or Reject"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
              </div>

              {/* Status Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--kt-soft-border)]">
                {driver.status === "PENDING_REVIEW" && (
                  <>
                    <Button onClick={() => handleStatusTransition("ACTIVE")} variant="primary" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Approve & Active
                    </Button>
                    <Button onClick={() => handleStatusTransition("REJECTED")} className="bg-[var(--kt-signal-red)] text-white hover:bg-[var(--kt-signal-red)]/90" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Reject Driver
                    </Button>
                  </>
                )}

                {driver.status === "ACTIVE" && (
                  <>
                    <Button onClick={() => handleStatusTransition("INACTIVE")} variant="secondary" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Set Inactive
                    </Button>
                    <Button onClick={() => handleStatusTransition("SUSPENDED")} className="bg-[var(--kt-signal-red)] text-white hover:bg-[var(--kt-signal-red)]/90" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Suspend Driver
                    </Button>
                  </>
                )}

                {driver.status === "INACTIVE" && (
                  <>
                    <Button onClick={() => handleStatusTransition("ACTIVE")} variant="primary" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Reactivate Active
                    </Button>
                    <Button onClick={() => handleStatusTransition("SUSPENDED")} className="bg-[var(--kt-signal-red)] text-white hover:bg-[var(--kt-signal-red)]/90" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Suspend Driver
                    </Button>
                  </>
                )}

                {driver.status === "SUSPENDED" && (
                  <>
                    <Button onClick={() => handleStatusTransition("ACTIVE")} variant="primary" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Reactivate Active
                    </Button>
                    <Button onClick={() => handleStatusTransition("INACTIVE")} variant="secondary" size="sm" loading={statusLoading} disabled={statusLoading}>
                      Set Inactive
                    </Button>
                  </>
                )}

                {driver.status === "REJECTED" && (
                  <Button onClick={() => handleStatusTransition("PENDING_REVIEW")} variant="secondary" size="sm" loading={statusLoading} disabled={statusLoading}>
                    Send to Review
                  </Button>
                )}
              </div>

              {/* Force Availability (Only Active) */}
              {driver.status === "ACTIVE" && (
                <div className="pt-4 border-t border-[var(--kt-soft-border)]">
                  <span className="block text-xs font-semibold text-[var(--kt-text-muted)] mb-2">Force Driver Availability State:</span>
                  <div className="flex gap-2">
                    <Button onClick={() => handleForceAvailability("AVAILABLE")} variant="secondary" size="sm" disabled={driver.availability === "AVAILABLE"}>
                      Force Available
                    </Button>
                    <Button onClick={() => handleForceAvailability("UNAVAILABLE")} variant="secondary" size="sm" disabled={driver.availability === "UNAVAILABLE"}>
                      Force Unavailable
                    </Button>
                    <Button onClick={() => handleForceAvailability("OFFLINE")} variant="secondary" size="sm" disabled={driver.availability === "OFFLINE"}>
                      Force Offline
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Coverage Regions Panel */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Service Regions Coverage
            </h3>

            {regionsSuccess && (
              <div className="text-xs text-[var(--kt-teal-emerald)] font-bold bg-[var(--kt-mint-wash)] p-2.5 rounded-xl border border-[var(--kt-teal-emerald)]">
                {regionsSuccess}
              </div>
            )}
            {regionsError && (
              <div role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)]">
                {regionsError}
              </div>
            )}

            <div className="space-y-4">
              <span className="block text-xs text-[var(--kt-text-muted)] font-medium">
                Select the service regions this driver operates in. If regions are assigned, select one primary region.
              </span>

              {/* Region List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-[var(--kt-soft-border)] rounded-xl bg-[var(--kt-cool-gray)]">
                {allRegions.map((region) => {
                  const checked = assignedRegionIds.includes(region.id);
                  return (
                    <label key={region.id} className="flex items-center gap-2.5 p-2 bg-[var(--kt-studio-white)] rounded-lg border border-[var(--kt-soft-border)] cursor-pointer text-xs select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => handleRegionCheckboxChange(region.id, e.target.checked)}
                        className="rounded border-[var(--kt-soft-border)] text-[var(--kt-signal-cobalt)] focus:ring-[var(--kt-signal-cobalt)]"
                      />
                      <span className="font-semibold text-[var(--kt-ink-navy)]">{region.name}</span>
                    </label>
                  );
                })}
              </div>

              {/* Primary Region Select */}
              {assignedRegionIds.length > 0 && (
                <div>
                  <Label htmlFor="primRegionSelect" required>Primary Region</Label>
                  <select
                    id="primRegionSelect"
                    value={primaryRegionId}
                    onChange={(e) => setPrimaryRegionId(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none"
                    required
                  >
                    <option value="">-- Select Primary Region --</option>
                    {allRegions
                      .filter((r) => assignedRegionIds.includes(r.id))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <Button onClick={handleSaveRegions} variant="secondary" size="sm" loading={regionsLoading} disabled={regionsLoading}>
                Update Regions Mappings
              </Button>
            </div>
          </div>
        </Card>

        {/* Vehicle Information Panel */}
        <Card>
          <form onSubmit={handleSaveVehicleInfo} className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Vehicle Profile
            </h3>

            {vehicleSuccess && (
              <div className="text-xs text-[var(--kt-teal-emerald)] font-bold bg-[var(--kt-mint-wash)] p-2.5 rounded-xl border border-[var(--kt-teal-emerald)]">
                {vehicleSuccess}
              </div>
            )}
            {vehicleError && (
              <div role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)]">
                {vehicleError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="vehTypeSelect">Vehicle Type</Label>
                <select
                  id="vehTypeSelect"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2.5 bg-white text-[var(--kt-text)] focus-visible:outline-none"
                >
                  <option value="">-- Select Type --</option>
                  <option value="MOTORBIKE">Motorbike</option>
                  <option value="CAR">Car</option>
                  <option value="VAN">Van</option>
                  <option value="TRUCK">Truck</option>
                  <option value="BICYCLE">Bicycle</option>
                  <option value="WALKER">Walker</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="vMakeInput">Make</Label>
                <Input
                  id="vMakeInput"
                  placeholder="e.g. Honda"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="vModelInput">Model</Label>
                <Input
                  id="vModelInput"
                  placeholder="e.g. NC750X"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="vColorInput">Color</Label>
                <Input
                  id="vColorInput"
                  placeholder="e.g. Matte Black"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="vRegInput">Registration</Label>
                <Input
                  id="vRegInput"
                  placeholder="e.g. CA 123-456"
                  value={vehicleRegistration}
                  onChange={(e) => setVehicleRegistration(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="licNumInput">License Number</Label>
                <Input
                  id="licNumInput"
                  placeholder="e.g. 8501015099081"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="licExpInput">License Expiry</Label>
                <input
                  id="licExpInput"
                  type="date"
                  className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]"
                  value={licenseExpiryDate}
                  onChange={(e) => setLicenseExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button type="submit" variant="secondary" size="sm" loading={vehicleLoading} disabled={vehicleLoading}>
                Update Vehicle Details
              </Button>
            </div>
          </form>
        </Card>

        {/* Future Assignments Placeholder */}
        <Card>
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Assigned Deliveries
            </h3>
            <div className="p-8 text-center bg-[var(--kt-cool-gray)] rounded-2xl border border-[var(--kt-soft-border)]">
              <p className="text-sm font-semibold text-[var(--kt-text-muted)]">
                Assignments will appear after dispatch is enabled.
              </p>
              <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                Dispatch engine is scheduled for Phase 2.5.
              </p>
            </div>
          </div>
        </Card>

        {/* Audit Logs Trail */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--kt-ink-navy)] border-b border-[var(--kt-soft-border)] pb-1.5">
              Driver Operation Audit Trail
            </h3>

            <div className="max-h-60 overflow-y-auto space-y-3">
              {logs.length === 0 ? (
                <p className="text-xs text-[var(--kt-text-muted)] italic py-4 text-center">No audit logs available for this driver.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 bg-[var(--kt-cool-gray)] rounded-xl border border-[var(--kt-soft-border)] flex flex-col sm:flex-row justify-between text-xs gap-2">
                    <div>
                      <span className="font-bold text-[var(--kt-ink-navy)] capitalize block sm:inline mr-2">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[var(--kt-text-muted)]">{log.message}</span>
                    </div>
                    <div className="text-right text-[10px] text-[var(--kt-text-muted)] flex-shrink-0">
                      <span>{log.actorUser?.name || log.actorUser?.email || "System"}</span>
                      <span className="block font-mono mt-0.5">{new Date(log.createdAt).toLocaleString("en-ZA")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
