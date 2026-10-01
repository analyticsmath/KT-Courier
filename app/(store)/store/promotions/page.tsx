import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
import { listBusinessPromotions } from "@/lib/client-platform/promotion-authoring.service";
import { Button } from "@/components/ui/Button";
export default async function Page() {
  const a = await requireBusinessPage("/store/promotions"),
    campaigns = await listBusinessPromotions(a.user.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title="Promotions"
        description="Manage coupons and automatic promotions for your business catalog."
        actions={<Button href="/store/promotions/new">New promotion</Button>}
      />
      <OperationalPanel title="Campaigns">
        {!campaigns.length ? (
          <p>
            No promotions yet. Create a draft to set its discount, dates,
            targets and usage limits.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    "Campaign",
                    "Status",
                    "Discount",
                    "Dates",
                    "Redemptions",
                  ].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.reference} className="border-t">
                    <td className="p-3">
                      <Link href={`/store/promotions/${c.reference}`}>
                        {c.name}
                      </Link>
                    </td>
                    <td className="p-3">{c.status.replaceAll("_", " ")}</td>
                    <td className="p-3">
                      {c.mechanism === "PERCENTAGE"
                        ? `${c.value}%`
                        : `R ${c.value}`}
                      {c.couponMasked && (
                        <span className="block text-sm">{c.couponMasked}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c.startsAt.slice(0, 10)} – {c.endsAt.slice(0, 10)}
                    </td>
                    <td className="p-3">{c.redemptions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
