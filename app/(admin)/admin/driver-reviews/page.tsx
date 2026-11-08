import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminDriverReviewOverview, normalizeAdminReviewFilters } from "@/lib/client-platform/driver-reviews.service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export const metadata: Metadata = { title: "Driver service reviews" };

type RawParams = Record<string, string | string[] | undefined>;
const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

export default async function AdminDriverReviewsPage({
  searchParams,
}: { searchParams: Promise<RawParams> }) {
  const actor = await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const raw = await searchParams;
  const filters = normalizeAdminReviewFilters({
    orderNumber: single(raw.order),
    driverId: single(raw.driver),
    customerId: single(raw.customer),
    rating: Number(single(raw.rating)),
    from: single(raw.from),
    to: single(raw.to),
    page: Number(single(raw.page)),
  });
  const overview = await getAdminDriverReviewOverview(actor, filters);
  function linkForPage(page: number) {
    const search = new URLSearchParams();
    if (filters.orderNumber) search.set("order", filters.orderNumber);
    if (filters.driverId) search.set("driver", filters.driverId);
    if (filters.customerId) search.set("customer", filters.customerId);
    if (filters.rating) search.set("rating", String(filters.rating));
    if (filters.from) search.set("from", filters.from);
    if (filters.to) search.set("to", filters.to);
    if (page > 1) search.set("page", String(page));
    const query = search.toString();
    return query ? "/admin/driver-reviews?" + query : "/admin/driver-reviews";
  }
  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Driver service reviews"
      description="Reviews tied to verified completed deliveries, with order, customer, driver and date evidence. Store and product reviews remain separate." />
    <OperationalPanel title="Driver review coverage">
      <p className="text-sm">Submitted reviews: <strong>{overview.reviewCount}</strong> ·
        Mean rating: <strong>{overview.average?.toFixed(2) ?? "Not available"}</strong></p>
      <p className="mt-2 text-xs text-[var(--kt-text-soft)]">Only a completed delivery with one uniquely identified completing driver qualifies. A ranking by review count is not a claim about driver quality.</p>
    </OperationalPanel>
    <OperationalPanel title="Most reviewed drivers">
      {overview.mostReviewed.length ? <div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr>
          <th scope="col" className="text-left">Driver</th><th scope="col" className="text-right">Reviews</th>
          <th scope="col" className="text-right">Mean rating</th></tr></thead>
          <tbody>{overview.mostReviewed.map(d => <tr className="border-t" key={d.driverId}>
            <td className="py-3"><Link className="underline" href={"/admin/drivers/"+encodeURIComponent(d.driverId)}>{d.name}</Link></td>
            <td className="py-3 text-right">{d.reviewCount}</td><td className="py-3 text-right">{d.average?.toFixed(2) ?? "—"}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm">No verified driver reviews yet.</p>}
    </OperationalPanel>
    <OperationalPanel title="Review investigation">
      <form method="get" action="/admin/driver-reviews" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Order number
          <input name="order" maxLength={80} defaultValue={filters.orderNumber ?? ""} placeholder="Search order reference"
            className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2" />
        </label>
        <label className="text-sm">Driver profile ID
          <input name="driver" maxLength={36} defaultValue={filters.driverId ?? ""} placeholder="Specific driver"
            className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2" />
        </label>
        <label className="text-sm">Customer user ID
          <input name="customer" maxLength={36} defaultValue={filters.customerId ?? ""} placeholder="Specific customer"
            className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2" />
        </label>
        <label className="text-sm">Rating
          <select name="rating" defaultValue={filters.rating ?? ""} className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2">
            <option value="">All ratings</option>{[1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value} stars</option>)}
          </select>
        </label>
        <label className="text-sm">From (Johannesburg date)
          <input type="date" name="from" defaultValue={filters.from ?? ""}
            className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2" />
        </label>
        <label className="text-sm">Through (Johannesburg date)
          <input type="date" name="to" defaultValue={filters.to ?? ""}
            className="mt-1 block w-full rounded-lg border border-[var(--kt-border)] bg-white p-2" />
        </label>
        <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="rounded-lg bg-[var(--kt-brand-navy)] px-4 py-2 text-sm font-semibold text-white">Apply filters</button>
          <Link href="/admin/driver-reviews" className="text-sm underline">Clear filters</Link>
        </div>
      </form>
      <p className="mt-4 text-sm" role="status">{overview.filteredTotal} matching reviews · Page {overview.currentPage} of {overview.pageCount}</p>
      {overview.recent.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--kt-border)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[var(--kt-surface-muted)]"><tr>
            {["Delivery", "Customer", "Driver", "Rating", "Date (ZA)", "Review"].map(label =>
              <th scope="col" key={label} className="p-3 text-left">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[var(--kt-border)]">
            {overview.recent.map(r => <tr key={r.id}>
              <td className="p-3 font-semibold">{r.orderNumber}</td>
              <td className="p-3">{r.customerName ?? "Customer account"}<small className="block break-all text-[var(--kt-text-soft)]">{r.customerId}</small></td>
              <td className="p-3"><Link className="underline" href={"/admin/drivers/"+encodeURIComponent(r.driverId)}>{r.driverName}</Link></td>
              <td className="p-3 tabular-nums">{r.rating}/5</td>
              <td className="p-3">{new Date(r.at).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}</td>
              <td className="max-w-md whitespace-pre-wrap p-3">{r.body}</td>
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="mt-3 text-sm">No reviews match the selected filters.</p>}
      <nav aria-label="Driver review result pages" className="mt-4 flex items-center gap-4">
        {overview.currentPage > 1 && <Link className="underline" href={linkForPage(overview.currentPage-1)}>Previous page</Link>}
        {overview.currentPage < overview.pageCount && <Link className="underline" href={linkForPage(overview.currentPage+1)}>Next page</Link>}
      </nav>
    </OperationalPanel>
  </ProtectedPageFrame>;
}
