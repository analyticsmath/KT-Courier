import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminDriverReviewOverview } from "@/lib/client-platform/driver-reviews.service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export const metadata: Metadata = { title: "Driver service reviews" };
export default async function AdminDriverReviewsPage() {
  const actor = await requireAdminPagePermission(PERMISSIONS.DRIVERS_READ);
  const overview = await getAdminDriverReviewOverview(actor);
  return <ProtectedPageFrame>
    <ProtectedPageHeader title="Driver service reviews"
      description="Verified completed-delivery customer reviews only; store and product reviews remain separate." />
    <OperationalPanel title="Driver review coverage">
      <p className="text-sm">Submitted reviews: <strong>{overview.reviewCount}</strong> ·
        Mean rating: <strong>{overview.average?.toFixed(2) ?? "Not available"}</strong></p>
      <p className="mt-2 text-xs text-[var(--kt-text-soft)]">An average is shown only when a customer reviewed a completed delivery with a uniquely identified driver. Rankings by review count are not claims about driver quality.</p>
    </OperationalPanel>
    <OperationalPanel title="Most reviewed drivers">
      {overview.mostReviewed.length ? <div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr>
          <th className="text-left">Driver</th><th className="text-right">Reviews</th>
          <th className="text-right">Mean rating</th></tr></thead>
          <tbody>{overview.mostReviewed.map(d => <tr className="border-t" key={d.driverId}>
            <td className="py-3"><Link className="underline" href={"/admin/drivers/"+encodeURIComponent(d.driverId)}>{d.name}</Link></td>
            <td className="py-3 text-right">{d.reviewCount}</td><td className="py-3 text-right">{d.average?.toFixed(2) ?? "—"}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm">No verified driver reviews yet.</p>}
    </OperationalPanel>
    <OperationalPanel title="Recent customer feedback">
      {overview.recent.length ? <div className="space-y-4">
        {overview.recent.map(r => <article key={r.id} className="rounded-xl border border-[var(--kt-border)] p-4">
          <p className="text-sm font-semibold">{r.driverName} · {r.rating}/5 · {r.orderNumber}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
          <p className="mt-2 text-xs">{new Date(r.at).toLocaleDateString("en-ZA")}</p>
        </article>)}
      </div> : <p>No recent driver reviews.</p>}
    </OperationalPanel>
  </ProtectedPageFrame>;
}
