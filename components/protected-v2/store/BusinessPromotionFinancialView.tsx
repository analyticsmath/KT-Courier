import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { businessPromotionFinancialView } from "@/lib/client-platform/promotion-authoring.service";
import { PlatformError } from "@/lib/client-platform/contracts";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
export async function BusinessPromotionFinancialView({
  reference,
  section,
}: {
  reference: string;
  section: "budget" | "redemptions";
}) {
  const a = await requireBusinessPage(
    `/store/promotions/[reference]/${section}`,
  );
  let data;
  try {
    data = await businessPromotionFinancialView(a.user.id, reference);
  } catch (e) {
    if (e instanceof PlatformError && e.status === 404) notFound();
    throw e;
  }
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title={
          section === "budget" ? "Promotion budget" : "Promotion redemptions"
        }
        description={`${data.name} · version ${data.version}`}
      />
      <Link href={`/store/promotions/${reference}`}>Back to campaign</Link>
      <OperationalPanel
        title={
          section === "budget" ? "Recorded budget" : "Latest 200 redemptions"
        }
      >
        {section === "budget" ? (
          data.budget ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              {Object.entries(data.budget).map(([k, v]) => (
                <div key={k}>
                  <dt className="capitalize">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>
              No funded budget is recorded. The draft’s proposed budget is a
              review request.
            </p>
          )
        ) : !data.redemptions.length ? (
          <p>No redemptions are recorded for this campaign version.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    "Reference",
                    "Date",
                    "Discount (ZAR)",
                    "Business funding (ZAR)",
                    "Status",
                  ].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.redemptions.map((r) => (
                  <tr key={r.publicReference} className="border-t">
                    {[
                      r.publicReference,
                      r.createdAt.slice(0, 10),
                      r.discountAmount,
                      r.storeFunding,
                      r.status,
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
