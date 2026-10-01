import { notFound, redirect } from "next/navigation";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { readBusinessSupportDashboard } from "@/lib/client-platform/support-access.service";
import { BusinessSupportAccess } from "@/components/forms/BusinessSupportAccess";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
export const metadata = { title: "Business support dashboard" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ grant?: string }>;
}) {
  const u = await requireAdminPagePermission("stores.read", "/admin");
  if (u.role !== "SUPER_ADMIN") redirect("/admin/stores");
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) notFound();
  const { grant } = await searchParams;
  let data, error;
  try {
    if (grant) data = await readBusinessSupportDashboard(u, id, grant);
  } catch (e) {
    error = e instanceof Error ? e.message : "Support session unavailable.";
  }
  if (!data)
    return (
      <ProtectedPageFrame>
        <ProtectedPageHeader
          title="Business support access"
          description="Open an audited support session with your own account."
        />
        <OperationalPanel title="Access reason">
          {error && (
            <p role="alert" className="mb-4">
              {error}
            </p>
          )}
          <BusinessSupportAccess storeId={id} />
        </OperationalPanel>
      </ProtectedPageFrame>
    );
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Super-admin support"
        title={data.store.name}
        description={`Read-only support session as ${data.grant.actorName}. Expires ${new Date(data.grant.expiresAt).toLocaleTimeString()}.`}
      />
      <OperationalPanel title="Access record">
        <p>{data.grant.reason}</p>
        <p className="mt-2 text-sm">
          Your real administrator identity is recorded. Business ownership and
          employee accounts remain unchanged.
        </p>
      </OperationalPanel>
      <OperationalPanel title="Business profile">
        <p>{data.store.status}</p>
        <p>
          {data.store.ownerUser?.name ?? "Owner"} ·{" "}
          {data.store.ownerUser?.email}
        </p>
        <p>
          {data.store.contactEmail} · {data.store.contactPhone}
        </p>
      </OperationalPanel>
      <div className="grid gap-5 md:grid-cols-2">
        {[
          { title: "Deliveries", rows: data.orders },
          { title: "Employees", rows: data.employees },
          { title: "Marketing campaigns", rows: data.marketing },
        ].map((s) => (
          <OperationalPanel key={s.title} title={s.title}>
            <dl className="space-y-3">
              {s.rows.map((r) => (
                <div key={r.status} className="flex justify-between">
                  <dt>{r.status.toLowerCase().replaceAll("_", " ")}</dt>
                  <dd>{r.count}</dd>
                </div>
              ))}
            </dl>
            {!s.rows.length && <p>No records yet.</p>}
          </OperationalPanel>
        ))}
        <OperationalPanel title="Reviews">
          <p>
            {data.reviews.count} reviews ·{" "}
            {data.reviews.rating?.toFixed(1) ?? "No rating"}
          </p>
        </OperationalPanel>
      </div>
      <OperationalPanel title="Membership contracts">
        {data.contracts.length ? (
          data.contracts.map((c) => (
            <p key={c.publicReference}>
              {c.publicReference} · {c.status.toLowerCase()}
            </p>
          ))
        ) : (
          <p>No membership contracts recorded.</p>
        )}
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
