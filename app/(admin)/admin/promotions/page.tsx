import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
import { listAdminPromotionRecords } from "@/lib/client-platform/promotion-authoring.service";
export default async function Page() {
  const user = await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_READ),
    rows = await listAdminPromotionRecords(user);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title="Promotion review"
        description="Review submitted business campaign rules and monitor their recorded status."
      />
      <OperationalPanel title="Latest 100 campaigns">
        {!rows.length ? (
          <p>No promotion campaigns are recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    "Campaign",
                    "Business",
                    "Status",
                    "Proposed budget",
                    "Redemptions",
                  ].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.reference} className="border-t">
                    <td className="p-3">
                      <Link href={`/admin/promotions/${c.reference}`}>
                        {c.name}
                      </Link>
                    </td>
                    {[
                      c.storeName,
                      c.status,
                      `R ${c.proposedBudget}`,
                      String(c.redemptions),
                    ].map((v, i) => (
                      <td key={i} className="p-3">
                        {v}
                      </td>
                    ))}
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
