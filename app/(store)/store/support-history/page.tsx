import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { listBusinessSupportHistory } from "@/lib/client-platform/support-access.service";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
export const metadata = { title: "Support access history" };
export default async function Page() {
  const a = await requireBusinessPage("/store/support-history"),
    rows = await listBusinessSupportHistory(a.user.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title="Support access history"
        description="Administrator access to your business retains the actual account, reason and time."
      />
      <OperationalPanel title="Recent support sessions">
        {rows.length ? (
          rows.map((r) => (
            <article key={r.id} className="space-y-2 border-b py-4">
              <h2 className="font-medium">{r.actor.name ?? r.actor.email}</h2>
              <p className="text-sm">
                {r.actor.email} ·{" "}
                <time dateTime={r.createdAt.toISOString()}>
                  {r.createdAt.toLocaleString()}
                </time>
              </p>
              <p>{r.reason}</p>
            </article>
          ))
        ) : (
          <p>No administrator support sessions recorded.</p>
        )}
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
