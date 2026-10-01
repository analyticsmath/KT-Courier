import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { businessMembershipView } from "@/lib/client-platform/membership-view.service";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
const titles = {
  overview: "Business membership",
  plans: "Membership plans",
  billing: "Membership billing",
  benefits: "Membership benefits",
};
export async function BusinessMembershipView({
  section,
}: {
  section: keyof typeof titles;
}) {
  const a = await requireBusinessPage(
      section === "overview"
        ? "/store/subscription"
        : `/store/subscription/${section}`,
    ),
    data = await businessMembershipView(a.user.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title={titles[section]}
        description="Your recorded membership contracts, invoices and benefit balances."
      />
      <nav aria-label="Membership" className="flex flex-wrap gap-5">
        {Object.entries(titles).map(([s, t]) => (
          <Link
            key={s}
            href={
              s === "overview"
                ? "/store/subscription"
                : `/store/subscription/${s}`
            }
            aria-current={s === section ? "page" : undefined}
          >
            {t}
          </Link>
        ))}
      </nav>
      {!data.canStartMembership && (
        <p>
          New memberships are not available yet. Existing membership records
          remain accessible.
        </p>
      )}
      {section === "overview" && (
        <OperationalPanel title="Membership contracts">
          {!data.contracts.length ? (
            <p>No membership contract is recorded for this business.</p>
          ) : (
            data.contracts.map((c) => (
              <article key={c.publicReference} className="border-b py-4">
                <h2>{c.planVersion.displayName}</h2>
                <p>
                  {c.status.replaceAll("_", " ")} · {c.currency}{" "}
                  {c.contractedPrice} / {c.billingIntervalCount}{" "}
                  {c.billingInterval.toLowerCase()}(s)
                </p>
                <p>
                  Paid through:{" "}
                  {c.paidThroughAt?.slice(0, 10) ??
                    "No recorded payment period"}
                </p>
                {c.currentPeriodEnd && (
                  <p>Current period ends: {c.currentPeriodEnd.slice(0, 10)}</p>
                )}
                {c.cancellationEffectiveAt && (
                  <p>
                    Cancellation effective:{" "}
                    {c.cancellationEffectiveAt.slice(0, 10)}
                  </p>
                )}
                <p className="text-sm">{c.publicReference}</p>
              </article>
            ))
          )}
        </OperationalPanel>
      )}
      {section === "plans" && (
        <OperationalPanel title="Current plans">
          {!data.plans.length ? (
            <p>No active business membership plan is available.</p>
          ) : (
            data.plans.map((p) => (
              <article key={p.publicReference} className="border-b py-4">
                <h2>{p.displayName}</h2>
                <p>{p.shortDescription}</p>
                <p>
                  {p.currency} {p.priceAmount} / {p.billingIntervalCount}{" "}
                  {p.billingInterval.toLowerCase()}(s)
                </p>
                <ul>
                  {p.benefits.map((b, i) => (
                    <li key={i}>
                      {b.benefitType.replaceAll("_", " ")}:{" "}
                      {b.quantity ?? b.amount ?? "Defined by plan terms"} per{" "}
                      {b.period}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </OperationalPanel>
      )}
      {section === "billing" && (
        <OperationalPanel title="Latest 200 invoices">
          {!data.invoices.length ? (
            <p>No membership invoices are recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    {[
                      "Invoice",
                      "Issued",
                      "Due",
                      "Subtotal",
                      "Tax",
                      "Total",
                      "Status",
                    ].map((t) => (
                      <th key={t} className="p-3">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.publicReference} className="border-t">
                      {[
                        i.invoiceNumber,
                        i.issuedAt.slice(0, 10),
                        i.dueAt.slice(0, 10),
                        `${i.currency} ${i.subtotal}`,
                        `${i.currency} ${i.taxAmount}`,
                        `${i.currency} ${i.total}`,
                        i.status,
                      ].map((v, n) => (
                        <td key={n} className="p-3">
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
      )}
      {section === "benefits" && (
        <OperationalPanel title="Latest 200 benefit grants">
          {!data.benefits.length ? (
            <p>No membership benefit grants are recorded.</p>
          ) : (
            data.benefits.map((b) => (
              <article key={b.publicReference} className="border-b py-4">
                <h2>{b.benefitDefinition.benefitType.replaceAll("_", " ")}</h2>
                <p>
                  {b.status} · {b.effectiveFrom.slice(0, 10)} –{" "}
                  {b.effectiveUntil.slice(0, 10)}
                </p>
                <p>
                  Remaining:{" "}
                  {b.remainingQuantity ?? b.remainingAmount ?? "Not applicable"}{" "}
                  of{" "}
                  {b.originalQuantity ?? b.originalAmount ?? "Not applicable"} (
                  {b.valueType.toLowerCase()})
                </p>
              </article>
            ))
          )}
        </OperationalPanel>
      )}
    </ProtectedPageFrame>
  );
}
