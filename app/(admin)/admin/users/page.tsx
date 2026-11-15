import type { Metadata } from "next";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import {
  ProtectedFilterBar,
  ProtectedPagination,
} from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getAdminCustomerDirectoryStats,
  getAdminCustomerSummariesForUserIds,
} from "@/lib/services/admin-customer-directory.service";
import { listUsers } from "@/lib/services/admin-users.service";
import { formatDateTime } from "@/lib/utils/formatters";
import { UserRole, UserStatus } from "@/types/db";

export const metadata: Metadata = { title: "Users and customer directory" };

const PAGE_SIZE = 25;
const VALID_ROLES = new Set<string>(Object.values(UserRole));
const VALID_STATUSES = new Set<string>(Object.values(UserStatus));

function buildHref(input: {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (input.role) params.set("role", input.role);
  if (input.status) params.set("status", input.status);
  if (input.search) params.set("search", input.search);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

function statusTone(status: UserStatus) {
  return status === UserStatus.ACTIVE
    ? ("success" as const)
    : status === UserStatus.PENDING_VERIFICATION
      ? ("warning" as const)
      : status === UserStatus.SUSPENDED
        ? ("danger" as const)
        : ("neutral" as const);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const viewer = await requireAdminPagePermission(PERMISSIONS.USERS_READ);
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  const role =
    filters.role && VALID_ROLES.has(filters.role)
      ? (filters.role as UserRole)
      : undefined;
  const status =
    filters.status && VALID_STATUSES.has(filters.status)
      ? (filters.status as UserStatus)
      : undefined;
  const search = filters.search?.trim().slice(0, 80) || "";

  const [{ data: users, total }, directoryStats] = await Promise.all([
    listUsers({
      role,
      status,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    getAdminCustomerDirectoryStats(),
  ]);

  const customerIdsOnPage = users
    .filter((u) => u.role === UserRole.CUSTOMER)
    .map((u) => u.id);
  const customerSummaries =
    await getAdminCustomerSummariesForUserIds(customerIdsOnPage);

  const rows = users.map((user) => ({
    ...user,
    customerSummary: customerSummaries.get(user.id) ?? null,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters =
    Number(Boolean(role)) + Number(Boolean(status)) + Number(Boolean(search));

  return (
    <ProtectedPageFrame className="eo-users-page">
      <ProtectedPageHeader
        eyebrow="Accounts & CRM"
        title="Users & Customer Directory"
        description={`${directoryStats.totalCustomers.toLocaleString("en-ZA")} registered customers (${directoryStats.activeCustomers.toLocaleString("en-ZA")} active, ${directoryStats.verifiedCustomers.toLocaleString("en-ZA")} email-verified) out of ${directoryStats.totalAccounts.toLocaleString("en-ZA")} platform accounts.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4">
          <p className="text-xs font-medium text-[var(--kt-text-muted)]">
            Total accounts
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kt-text)]">
            {directoryStats.totalAccounts.toLocaleString("en-ZA")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4">
          <p className="text-xs font-medium text-[var(--kt-text-muted)]">
            Registered customers
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kt-text)]">
            {directoryStats.totalCustomers.toLocaleString("en-ZA")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4">
          <p className="text-xs font-medium text-[var(--kt-text-muted)]">
            Active customers
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kt-text)]">
            {directoryStats.activeCustomers.toLocaleString("en-ZA")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface)] p-4">
          <p className="text-xs font-medium text-[var(--kt-text-muted)]">
            Verified emails
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--kt-text)]">
            {directoryStats.verifiedCustomers.toLocaleString("en-ZA")}
          </p>
        </div>
      </div>

      <ProtectedFilterBar
        activeFilterCount={activeFilters}
        clearHref={activeFilters ? "/admin/users" : undefined}
      >
        <form
          action="/admin/users"
          className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
        >
          <label className="eo-filter-label" htmlFor="admin-users-role">
            Role
            <select
              id="admin-users-role"
              name="role"
              defaultValue={role ?? ""}
            >
              <option value="">All roles</option>
              <option value={UserRole.CUSTOMER}>Customer</option>
              <option value={UserRole.STORE}>Store</option>
              <option value={UserRole.DRIVER}>Driver</option>
              <option value={UserRole.PROMOTER}>Promoter</option>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
            </select>
          </label>
          <label className="eo-filter-label" htmlFor="admin-users-status">
            Status
            <select
              id="admin-users-status"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All statuses</option>
              <option value={UserStatus.ACTIVE}>Active</option>
              <option value={UserStatus.PENDING_VERIFICATION}>
                Pending verification
              </option>
              <option value={UserStatus.SUSPENDED}>Suspended</option>
              <option value={UserStatus.DISABLED}>Disabled</option>
            </select>
          </label>
          <label className="eo-filter-label" htmlFor="admin-users-search">
            Search users
            <input
              id="admin-users-search"
              name="search"
              defaultValue={search}
              placeholder="Customer or account name or email"
            />
          </label>
          <button className="eo-filter-submit" type="submit">
            Filter
          </button>
        </form>
      </ProtectedFilterBar>

      <OperationalPanel
        accent="blue"
        title="Platform account & customer directory"
        description={`${total.toLocaleString("en-ZA")} matching account${total === 1 ? "" : "s"}. Customer parcel orders, store orders, wallet balance, loyalty points, and ordinary referrals are loaded per page.`}
      >
        <EditorialTable
          caption="Users and customer account metrics"
          mobileMode="stack"
          rows={rows}
          emptyState={
            <ProtectedState
              kind="empty"
              title="No matching accounts"
              description="Try clearing the role, status, or search filter."
            />
          }
          columns={[
            {
              id: "identity",
              header: "Account",
              priority: "primary",
              cell: (user) => (
                <div>
                  <strong>{user.name ?? "Name unavailable"}</strong>
                  <small className="block">{user.email}</small>
                  {viewer.role === UserRole.SUPER_ADMIN &&
                    user.role === UserRole.CUSTOMER &&
                    user.status === UserStatus.ACTIVE && (
                      <Link
                        href={`/admin/users/${encodeURIComponent(user.id)}/wallet-credit`}
                        className="mt-1 inline-block text-xs font-semibold underline"
                      >
                        Credit customer wallet
                      </Link>
                    )}
                </div>
              ),
            },
            {
              id: "roleStatus",
              header: "Role & status",
              priority: "primary",
              cell: (user) => (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--kt-text-soft)]">
                    {user.role}
                  </div>
                  <ProtectedStatus
                    label={user.status}
                    tone={statusTone(user.status)}
                  />
                </div>
              ),
            },
            {
              id: "ordersSpend",
              header: "Parcel & store activity",
              priority: "secondary",
              cell: (user) => {
                const s = user.customerSummary;
                if (!s) return <span className="text-xs text-[var(--kt-text-muted)]">—</span>;
                return (
                  <div className="text-xs space-y-0.5">
                    <div>
                      Parcel: <strong>{s.parcelOrderCount}</strong> (R{" "}
                      {s.parcelPaidSpendZar})
                    </div>
                    <div>
                      Shop: <strong>{s.marketplaceOrderCount}</strong> (R{" "}
                      {s.marketplacePaidSpendZar})
                    </div>
                    <div className="text-[var(--kt-text-muted)]">
                      Combined: {s.totalOrderCount} orders · R{" "}
                      {s.totalPaidSpendZar}
                    </div>
                  </div>
                );
              },
            },
            {
              id: "walletLoyalty",
              header: "Wallet & points",
              priority: "secondary",
              cell: (user) => {
                const s = user.customerSummary;
                if (!s) return <span className="text-xs text-[var(--kt-text-muted)]">—</span>;
                return (
                  <div className="text-xs space-y-0.5">
                    <div>
                      Wallet: <strong>R {s.walletAvailableZar}</strong>
                    </div>
                    <div>
                      Points:{" "}
                      <strong>
                        {s.loyaltyAvailablePoints.toLocaleString("en-ZA")}
                      </strong>
                      {s.loyaltyDebtPoints > 0
                        ? ` (${s.loyaltyDebtPoints.toLocaleString("en-ZA")} debt)`
                        : ""}
                    </div>
                  </div>
                );
              },
            },
            {
              id: "referrals",
              header: "Ordinary referrals",
              priority: "optional",
              cell: (user) => {
                const s = user.customerSummary;
                if (!s) return <span className="text-xs text-[var(--kt-text-muted)]">—</span>;
                return (
                  <div className="text-xs space-y-0.5">
                    <div>Code: {s.referralCode ?? "Not issued"}</div>
                    <div className="text-[var(--kt-text-muted)]">
                      {s.referralsRewarded} rewarded · {s.referralsPending}{" "}
                      pending
                    </div>
                  </div>
                );
              },
            },
            {
              id: "created",
              header: "Joined",
              priority: "secondary",
              cell: (user) => <time>{formatDateTime(user.createdAt)}</time>,
            },
          ]}
        />
      </OperationalPanel>

      <ProtectedPagination
        currentPage={page}
        pageCount={pageCount}
        hrefForPage={(nextPage) =>
          buildHref({
            role,
            status,
            search,
            page: nextPage,
          })
        }
      />
    </ProtectedPageFrame>
  );
}
