import studio from "@/components/protected-v2/studio/workspaceStudio.module.css";
import {
  StageBars,
  DistributionRing,
} from "@/components/protected-v2/studio/StudioCharts";
import { getDriverDirectoryInsights } from "@/lib/dashboard-insights/driver-directory-insights";
import {
  ProtectedFilterBar,
  ProtectedPagination,
} from "@/components/protected-v2/data/FilterAndPagination";
import { DriverStatus, DriverAvailability } from "@/types/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDrivers } from "@/lib/services/admin-drivers.service";

export const metadata: Metadata = { title: "Driver administration" };
function driverTone(status: string) {
  return status === "ACTIVE"
    ? ("success" as const)
    : status === "PENDING_REVIEW"
      ? ("warning" as const)
      : status === "SUSPENDED" || status === "REJECTED"
        ? ("danger" as const)
        : ("neutral" as const);
}
function availabilityTone(status: string) {
  return status === "AVAILABLE"
    ? ("success" as const)
    : status === "ON_DELIVERY"
      ? ("information" as const)
      : status === "UNAVAILABLE"
        ? ("warning" as const)
        : ("neutral" as const);
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    availability?: string;
    page?: string;
  }>;
}) {
  await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const query = await searchParams;
  const status = Object.values(DriverStatus).includes(
    query.status as DriverStatus,
  )
    ? (query.status as DriverStatus)
    : undefined;
  const availability = Object.values(DriverAvailability).includes(
    query.availability as DriverAvailability,
  )
    ? (query.availability as DriverAvailability)
    : undefined;
  const search = query.search?.trim().slice(0, 80) ?? "";
  const requested = Number(query.page);
  const page =
    Number.isSafeInteger(requested) && requested > 0 && requested < 1000000
      ? requested
      : 1;
  const [{ data: drivers, total }, fleet] = await Promise.all([
    listDrivers({ page, pageSize: 25, status, availability, search }),
    getDriverDirectoryInsights(),
  ]);
  const href = (next: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (availability) params.set("availability", availability);
    if (next > 1) params.set("page", String(next));
    return `/admin/drivers?${params}`;
  };
  if (page > Math.max(1, Math.ceil(total / 25)))
    redirect(href(Math.max(1, Math.ceil(total / 25))));
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="People and network"
        title="Driver administration"
        description={`${total} matching driver profile${total === 1 ? "" : "s"}. Review documents, availability and service regions.`}
      />
      <section
        className={studio.directoryAnalytics}
        aria-label="Entire fleet analytics"
      >
        <article className={`${studio.panel} ${studio.bluePanel}`}>
          <h2>Registered drivers</h2>
          <p className={studio.balance}>{fleet.total}</p>
          <p className={studio.notice}>
            Entire fleet, across all directory pages and filters
          </p>
        </article>
        <article className={studio.panel}>
          <div className={studio.panelTitle}>
            <h2>Account states</h2>
          </div>
          <StageBars
            label="Entire fleet account states"
            items={fleet.status.map((row) => ({
              label: row.status.replaceAll("_", " ").toLowerCase(),
              value: row._count._all,
              color:
                row.status === "ACTIVE"
                  ? "#1768ff"
                  : row.status === "PENDING_REVIEW"
                    ? "#b6574c"
                    : "#596474",
            }))}
          />
        </article>
        <article className={`${studio.panel} ${studio.yellowPanel}`}>
          <div className={studio.panelTitle}>
            <h2>Current availability</h2>
          </div>
          <DistributionRing
            label="Entire fleet availability"
            unit="drivers"
            items={fleet.availability.map((row) => ({
              label: row.availability.replaceAll("_", " ").toLowerCase(),
              value: row._count._all,
              color:
                row.availability === "AVAILABLE"
                  ? "#1768ff"
                  : row.availability === "ON_DELIVERY"
                    ? "#191a1e"
                    : "#727a67",
            }))}
          />
        </article>
      </section>
      <ProtectedFilterBar
        activeFilterCount={
          Number(Boolean(status)) +
          Number(Boolean(availability)) +
          Number(Boolean(search))
        }
        clearHref="/admin/drivers"
      >
        <form
          action="/admin/drivers"
          className="flex flex-1 flex-wrap items-end gap-3"
        >
          <label className="eo-filter-label" htmlFor="driver-search">
            Find driver
            <input
              id="driver-search"
              name="search"
              defaultValue={search}
              placeholder="Name, driver code or email"
            />
          </label>
          <label className="eo-filter-label" htmlFor="driver-status">
            Account state
            <select
              id="driver-status"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All states</option>
              {Object.values(DriverStatus).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="eo-filter-label" htmlFor="driver-availability">
            Availability
            <select
              id="driver-availability"
              name="availability"
              defaultValue={availability ?? ""}
            >
              <option value="">All availability</option>
              {Object.values(DriverAvailability).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="eo-filter-submit">
            Apply filters
          </button>
        </form>
      </ProtectedFilterBar>
      <OperationalPanel
        accent="blue"
        title="Driver directory"
        description="Review account status, availability, service region and vehicle details."
      >
        <EditorialTable
          caption="Driver administration directory"
          mobileMode="stack"
          rows={drivers}
          emptyState={
            <ProtectedState
              kind="empty"
              title="No driver profiles are available"
              description="New driver profiles appear here after registration."
            />
          }
          columns={[
            {
              id: "driver",
              header: "Driver",
              priority: "primary",
              cell: (driver) => (
                <div>
                  <Link
                    className="eo-table-link"
                    href={`/admin/drivers/${driver.id}`}
                  >
                    {driver.displayName ?? driver.driverCode}
                  </Link>
                  <small>{driver.driverCode}</small>
                </div>
              ),
            },
            {
              id: "status",
              header: "Operational state",
              priority: "primary",
              cell: (driver) => (
                <ProtectedStatus
                  label={driver.status.replaceAll("_", " ")}
                  tone={driverTone(driver.status)}
                />
              ),
            },
            {
              id: "availability",
              header: "Availability",
              priority: "secondary",
              cell: (driver) => (
                <ProtectedStatus
                  label={driver.availability.replaceAll("_", " ")}
                  tone={availabilityTone(driver.availability)}
                />
              ),
            },
            {
              id: "region",
              header: "Primary region",
              priority: "secondary",
              cell: (driver) => driver.primaryRegion?.name ?? "Not assigned",
            },
            {
              id: "vehicle",
              header: "Vehicle",
              priority: "optional",
              cell: (driver) =>
                driver.vehicleType?.replaceAll("_", " ") ?? "Not recorded",
            },
            {
              id: "action",
              header: "",
              priority: "optional",
              cell: (driver) => (
                <Link
                  className="eo-table-action"
                  href={`/admin/drivers/${driver.id}`}
                >
                  Open<span className="sr-only"> {driver.driverCode}</span>
                </Link>
              ),
            },
          ]}
        />
      </OperationalPanel>
      <ProtectedPagination
        currentPage={page}
        pageCount={Math.max(1, Math.ceil(total / 25))}
        hrefForPage={href}
      />
    </ProtectedPageFrame>
  );
}
