import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { getStoreSellerIdentityState } from "@/lib/services/store-seller-identity.service";
import { StoreSellerIdentityReview } from "@/components/admin/StoreSellerIdentityReview";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function StoreSellerIdentityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.STORES_READ); await requireAdminPagePermission(PERMISSIONS.LEGAL_DOCUMENTS_READ);
  const { id } = await params; const store = await prisma.store.findUnique({ where: { id }, select: { name: true } }); if (!store) notFound();
  const state = await getStoreSellerIdentityState(id);
  const allowed = (await Promise.all([PERMISSIONS.STORES_APPROVE, PERMISSIONS.LEGAL_DOCUMENTS_PUBLISH].map(permissionKey => hasPermission({ userId: user.id, role: user.role, permissionKey })))).every(Boolean);
  return <ProtectedPageFrame><ProtectedPageHeader title="Seller identity review" eyebrow="Store governance" description={store.name} />
    <OperationalPanel title="Latest approved version"><p>{state.currentIdentity ? `${state.currentIdentity.identityVersion} · ${state.currentIdentity.legalName}` : "No approved seller identity."}</p><p>Approval applies to the recorded effective window. Commercial policy approval remains a separate checkout requirement.</p></OperationalPanel>
    {state.proposals.map(item => <OperationalPanel key={item.reference} title={`${item.input.identityVersion} · ${item.status.replaceAll("_", " ")}`}>
      <dl className="grid gap-2 break-words sm:grid-cols-2"><dt>Legal seller name</dt><dd>{item.input.legalName}</dd><dt>Trading name</dt><dd>{item.input.tradingName ?? "Not supplied"}</dd><dt>Registration reference</dt><dd>{item.input.registrationReference ?? "Not supplied"}</dd><dt>VAT status</dt><dd>{item.input.vatRegistrationStatus}</dd><dt>VAT reference</dt><dd>{item.input.vatNumber ?? "Not supplied"}</dd><dt>Receipt classification</dt><dd>{item.input.invoiceClassification}</dd><dt>Terms reference</dt><dd>{item.input.termsReference ?? "Not supplied"}</dd><dt>Effective from</dt><dd>{item.input.effectiveFrom}</dd><dt>Effective until</dt><dd>{item.input.effectiveUntil ?? "Open ended"}</dd><dt>Supplied evidence</dt><dd>{item.input.sourceEvidenceReference}</dd></dl>
      {item.status === "PENDING_REVIEW" && allowed ? <StoreSellerIdentityReview storeId={id} proposalReference={item.reference} updatedAt={item.updatedAt} /> : null}
    </OperationalPanel>)}
    {!state.proposals.length ? <p>No owner submissions are awaiting review.</p> : null}
  </ProtectedPageFrame>;
}
