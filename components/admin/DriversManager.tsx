"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/types/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { EmptyState } from "@/components/ui/EmptyState";
import { DriverStatus, DriverAvailability, VehicleType } from "@/types/db";
import { DRIVER_STATUS_LABELS, DRIVER_AVAILABILITY_LABELS } from "@/lib/constants/drivers";

interface Region {
  id: string;
  name: string;
}

interface UnlinkedUser {
  id: string;
  email: string;
  name: string | null;
}

interface DriverSummary {
  id: string;
  driverCode: string;
  displayName: string | null;
  phone: string | null;
  status: DriverStatus;
  availability: DriverAvailability;
  vehicleType: VehicleType | null;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
  };
  primaryRegion: {
    name: string;
  } | null;
}

interface DriversManagerProps {
  initialRegions: Region[];
}

export function DriversManager({ initialRegions }: DriversManagerProps) {
  // Lists & pagination state
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Create Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Fetch drivers with filters
  const fetchDrivers = useCallback(async () => {
    // Reference refreshTrigger to satisfy dependency linting
    const _trigger = refreshTrigger;
    await Promise.resolve();
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
      });
      if (appliedSearch) params.append("search", appliedSearch);
      if (statusFilter) params.append("status", statusFilter);
      if (availabilityFilter) params.append("availability", availabilityFilter);
      if (regionFilter) params.append("regionId", regionFilter);

      const res = await fetch(`/api/admin/drivers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.data);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to fetch drivers:", err, _trigger);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, statusFilter, availabilityFilter, regionFilter, refreshTrigger]);

  // Fetch unlinked users
  const fetchUnlinkedUsers = async () => {
    try {
      const res = await fetch("/api/admin/drivers/unlinked");
      if (res.ok) {
        const data = await res.json();
        setUnlinkedUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch unlinked users:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDrivers();
  }, [fetchDrivers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search);
  };

  const handleOpenLinkModal = () => {
    fetchUnlinkedUsers();
    setSelectedUserId("");
    setDisplayName("");
    setPhone("");
    setVehicleType("");
    setVehicleRegistration("");
    setCreateError("");
    setModalOpen(true);
  };

  const handleCreateDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setCreateError("Please select a user to link.");
      return;
    }

    setCreateLoading(true);
    setCreateError("");

    try {
      const payload: Record<string, string | undefined> = {
        userId: selectedUserId,
        displayName: displayName || undefined,
        phone: phone || undefined,
        vehicleType: vehicleType || undefined,
        vehicleRegistration: vehicleRegistration || undefined,
      };

      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create driver profile.");
      }

      setModalOpen(false);
      setPage(1);
      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setCreateLoading(false);
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
    <div className="space-y-6">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-[var(--kt-studio-white)] p-4 rounded-2xl border border-[var(--kt-soft-border)]">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 max-w-md">
          <Input
            placeholder="Search driver code, name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        <Button onClick={handleOpenLinkModal} variant="primary" size="md">
          Link Driver Profile
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[var(--kt-studio-white)] p-4 rounded-2xl border border-[var(--kt-soft-border)]">
        <div>
          <Label htmlFor="statusFilter">Status</Label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]"
          >
            <option value="">All Statuses</option>
            {Object.entries(DRIVER_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="availFilter">Availability</Label>
          <select
            id="availFilter"
            value={availabilityFilter}
            onChange={(e) => {
              setAvailabilityFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]"
          >
            <option value="">All Availabilities</option>
            {Object.entries(DRIVER_AVAILABILITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="regionFilter">Region</Label>
          <select
            id="regionFilter"
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]"
          >
            <option value="">All Regions</option>
            {initialRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drivers List */}
      {loading ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--kt-soft-border)] border-t-[var(--kt-signal-cobalt)]" />
            <p className="text-sm text-[var(--kt-text-muted)] font-medium">Loading drivers...</p>
          </div>
        </Card>
      ) : drivers.length === 0 ? (
        <EmptyState
          title="No drivers found"
          description="Try adjusting your filters or search query, or link a new driver user."
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--kt-soft-border)] bg-[var(--kt-cool-gray)] text-[var(--kt-text-muted)]">
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Driver Code</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Name</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Contact</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Region</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Vehicle</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Status</th>
                      <th className="px-5 py-4 text-left font-semibold uppercase tracking-wide text-xs">Availability</th>
                      <th className="px-5 py-4 text-right font-semibold uppercase tracking-wide text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--kt-soft-border)]">
                    {drivers.map((driver) => (
                      <tr key={driver.id} className="bg-[var(--kt-studio-white)] hover:bg-[var(--kt-cool-gray)] transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-[var(--kt-ink-navy)]">{driver.driverCode}</td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-[var(--kt-ink-navy)]">{driver.displayName || "No Name"}</span>
                          <span className="block text-[11px] text-[var(--kt-text-muted)] mt-0.5">{driver.user.email}</span>
                        </td>
                        <td className="px-5 py-4 text-[var(--kt-text-muted)] tabular-nums">{driver.phone || "No phone"}</td>
                        <td className="px-5 py-4">
                          {driver.primaryRegion ? (
                            <span className="text-xs font-semibold px-2.5 py-1 bg-[var(--kt-cloud-blue)] text-[var(--kt-signal-cobalt)] rounded-lg">
                              {driver.primaryRegion.name}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--kt-text-muted)] italic">None</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-[var(--kt-text-muted)] capitalize">
                          {driver.vehicleType?.toLowerCase() || "None"}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getStatusBadgeVariant(driver.status)}>
                            {DRIVER_STATUS_LABELS[driver.status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={getAvailabilityBadgeVariant(driver.availability)}>
                            {DRIVER_AVAILABILITY_LABELS[driver.availability]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={`/admin/drivers/${driver.id}`}>
                            <Button variant="secondary" size="sm">
                              Manage
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Card Layout Fallback */}
          <div className="block md:hidden space-y-4">
            {drivers.map((driver) => (
              <Card key={driver.id}>
                <div className="flex justify-between items-start border-b border-[var(--kt-soft-border)] pb-3 mb-3">
                  <div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[var(--kt-cool-gray)] text-[var(--kt-ink-navy)] rounded-lg mr-2">
                      {driver.driverCode}
                    </span>
                    <span className="font-bold text-[var(--kt-ink-navy)] text-sm">{driver.displayName || "No name"}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(driver.status)}>
                    {DRIVER_STATUS_LABELS[driver.status]}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 text-xs text-[var(--kt-text-muted)]">
                  <div>
                    <span className="block font-semibold uppercase text-[10px] tracking-wider text-[var(--kt-text-muted)] mb-0.5">Email</span>
                    {driver.user.email}
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-[10px] tracking-wider text-[var(--kt-text-muted)] mb-0.5">Phone</span>
                    {driver.phone || "No phone"}
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-[10px] tracking-wider text-[var(--kt-text-muted)] mb-0.5">Primary Region</span>
                    {driver.primaryRegion?.name || "None"}
                  </div>
                  <div>
                    <span className="block font-semibold uppercase text-[10px] tracking-wider text-[var(--kt-text-muted)] mb-0.5">Availability</span>
                    <Badge variant={getAvailabilityBadgeVariant(driver.availability)}>
                      {DRIVER_AVAILABILITY_LABELS[driver.availability]}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link href={`/admin/drivers/${driver.id}`} className="w-full">
                    <Button variant="secondary" size="sm" fullWidth>
                      Manage Profile
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--kt-soft-border)] pt-4 mt-6">
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="secondary"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-xs text-[var(--kt-text-muted)] font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                variant="secondary"
                size="sm"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Link Driver Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--kt-studio-white)] rounded-3xl p-6 shadow-2xl border border-[var(--kt-soft-border)] space-y-4">
            <div className="flex justify-between items-start border-b border-[var(--kt-soft-border)] pb-3">
              <h2 className="text-lg font-bold text-[var(--kt-ink-navy)]">Link Driver Profile</h2>
              <button onClick={() => setModalOpen(false)} className="text-[var(--kt-text-muted)] hover:text-[var(--kt-ink-navy)] font-bold text-lg leading-none">
                &times;
              </button>
            </div>

            {createError && (
              <div role="alert" className="p-3 text-xs bg-[var(--kt-red-soft)] text-[var(--kt-red)] rounded-xl border border-[var(--kt-red)]">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateDriverProfile} className="space-y-4">
              <div>
                <Label htmlFor="userSelect" required>Select DRIVER User</Label>
                <select
                  id="userSelect"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2.5 bg-white text-[var(--kt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]"
                  required
                >
                  <option value="">-- Choose User --</option>
                  {unlinkedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
                {unlinkedUsers.length === 0 && (
                  <p className="text-[11px] text-[var(--kt-text-muted)] mt-1.5 italic">
                    No unlinked users with the DRIVER role. Create a user with role DRIVER under Customers/Users first.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="dispName">Display Name (Optional)</Label>
                <Input
                  id="dispName"
                  placeholder="e.g. Sipho Nkosi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="phNum">Phone (Optional)</Label>
                <Input
                  id="phNum"
                  placeholder="e.g. +27 82 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="vType">Vehicle Type</Label>
                  <select
                    id="vType"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full text-sm rounded-xl border border-[var(--kt-soft-border)] px-3 py-2 bg-white text-[var(--kt-text)] focus-visible:outline-none"
                  >
                    <option value="">-- None --</option>
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
                  <Label htmlFor="vReg">Registration</Label>
                  <Input
                    id="vReg"
                    placeholder="e.g. CA 123-456"
                    value={vehicleRegistration}
                    onChange={(e) => setVehicleRegistration(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 justify-end border-t border-[var(--kt-soft-border)]">
                <Button type="button" onClick={() => setModalOpen(false)} variant="secondary" size="md">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={createLoading} disabled={createLoading}>
                  Create Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
