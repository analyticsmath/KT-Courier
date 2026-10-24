import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreDetail } from "@/lib/services/admin-stores.service";
import { vendorReviewChecklist } from "@/lib/admin/vendor-review-checklist";
import { getStoreCommissionReadiness } from "@/lib/admin/store-commission-readiness";
import { StoreAccountApproval } from "@/components/admin/StoreAccountApproval";
import { StoreAccountStatusActions } from "@/components/admin/StoreAccountStatusActions";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export const metadata: Metadata = { title: "Vendor account dossier" };

function fact(label: string, value: string | null | undefined) {
  return <div className="min-w-0 border-b pb-3"><dt className="text-sm text-[var(--kt-text-muted)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value?.trim() || "Not supplied"}</dd></div>;
}
function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(value) : "Not recorded";
}

export default async function AdminStoreDossier({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPagePermission(PERMISSIONS.STORES_READ);
  const { id } = await params;
  const [store, canApprove, canReviewSeller, canManagePricing, canReadCommission] = await Promise.all([
    getStoreDetail(id),
    hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.STORES_APPROVE }),
    hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.LEGAL_DOCUMENTS_READ }),
    hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.PRICING_MANAGE }),
    hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.COMMISSION_PLANS_READ }),
  ]);
  if (!store) notFound();
  const now = new Date();
  const [storefront, publishedOfferCount, catalogOfferCount, legalSeller, negotiatedRateCount, commissionReadiness] = await Promise.all([
    prisma.storefrontStoreDocument.findUnique({ where: { storeId: id }, select: { publicStatus: true, publishedOfferCount: true, indexedAt: true } }),
    prisma.storefrontProductDocument.count({ where: { storeId: id, status: "ACTIVE", searchable: true } }),
    prisma.storeCatalogOffer.count({ where: { storeId: id } }),
    canReviewSeller ? prisma.storeSellerLegalIdentity.findFirst({ where: { storeId: id, status: "APPROVED", effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }, orderBy: { effectiveFrom: "desc" }, select: { legalName: true, tradingName: true, registrationReference: true, vatRegistrationStatus: true, identityVersion: true } }) : Promise.resolve(null),
    canManagePricing ? prisma.personalizedDeliveryRate.count({ where: { ownerType: "STORE", ownerId: id, status: "ACTIVE" } }) : Promise.resolve(0),
    canReadCommission ? getStoreCommissionReadiness(id, prisma, now) : Promise.resolve(null),
  ]);
  const owner = store.ownerUser;
  const summary = vendorReviewChecklist({
    hasOwner: Boolean(owner),
    ownerActive: owner?.status === "ACTIVE",
    ownerEmailVerified: Boolean(owner?.emailVerifiedAt),
    hasBusinessContact: Boolean(store.contactEmail || store.contactPhone || owner?.storeProfile?.businessEmail || owner?.storeProfile?.businessPhone),
    hasPickupAddress: Boolean(store.defaultPickupAddressId),
    hasApprovedSellerIdentity: Boolean(legalSeller),
    publishedOfferCount,
    storefrontActive: storefront?.publicStatus === "ACTIVE",
  });
  return <ProtectedPageFrame>
    <ProtectedPageHeader title={store.name} description={`Vendor account dossier · ${store.status.toLowerCase()} · joined ${date(store.createdAt)}`} />
    <Link href="/admin/stores" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Back to stores</Link>
    <OperationalPanel title="Review before account activation" description="This dossier uses actual stored details, not assumed approvals. Vendor account activation does not automatically approve seller identity, products, drivers, payments, COD or marketing campaigns.">
      <div className="grid gap-3 sm:grid-cols-2">
        {summary.map(item => <div key={item.key} className="rounded-lg border p-4">
          <p className="text-sm font-semibold">{item.title} — {item.ready ? "Recorded" : "Needs review"}</p>
          <p className="mt-2 text-sm">{item.explanation}</p>
        </div>)}
      </div>
      {canApprove && store.status === "PENDING" ? <div className="mt-5 border-t pt-5"><StoreAccountApproval storeId={store.id} /></div> : null}
      {canApprove && store.status !== "PENDING" ? <div className="mt-5 border-t pt-5"><StoreAccountStatusActions storeId={store.id} status={store.status} /></div> : null}
    </OperationalPanel>
    <OperationalPanel title="Marketplace settlement readiness" description="Before customers can complete marketplace checkout, this store must have an active approved commission policy. Catalog publication and vendor account approval do not authorise seller deductions.">
      {!canReadCommission ? <p className="text-sm">Finance permission is required to review marketplace commission plans.</p> :
        <div className="space-y-3">
          <p role="status" className="text-sm font-semibold">
            {commissionReadiness?.status === "READY" ? "Approved commission plan active — checkout settlement gate satisfied"
              : commissionReadiness?.status === "MISSING" ? "No commission plan exists for this store"
              : commissionReadiness?.status === "APPROVED_NOT_ACTIVE" ? "Commission plan approved but not activated"
              : commissionReadiness?.status === "OUTSIDE_EFFECTIVE_PERIOD" ? "Plan exists but is not currently effective"
              : commissionReadiness?.status === "ENTITLEMENT_MISMATCH" ? "Subscription entitlement does not match an effective approved plan"
              : "Commission plan pending independent review or activation"}
          </p>
          {commissionReadiness?.planReference ? <p className="text-sm">Policy reference: {commissionReadiness.planReference}</p> : null}
          {!commissionReadiness?.ready && publishedOfferCount > 0
            ? <p className="text-sm">This store has {publishedOfferCount} published offer(s), but checkout settlement is blocked until the policy is ready.</p>
            : null}
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            {commissionReadiness?.planId
              ? <Link className="underline underline-offset-4" href={`/admin/commission-plans/${encodeURIComponent(commissionReadiness.planId)}`}>Review this commission plan</Link>
              : <Link className="underline underline-offset-4" href={`/admin/commission-plans?storeId=${encodeURIComponent(id)}`}>Prepare commission plan for this store</Link>}
            <Link className="underline underline-offset-4" href="/admin/commission-plans">View commission policies</Link>
          </div>
          <p className="text-xs text-[var(--kt-text-muted)]">Draft creation, independent approval, activation, and any subscription restrictions remain server-authoritative.</p>
        </div>}
    </OperationalPanel>
    <OperationalPanel title="Business registration" description="Business, contact and collection details as currently recorded in the store account.">
      <dl className="grid gap-4 sm:grid-cols-2">
        {fact("Registered store name", store.name)}
        {fact("Store profile name", owner?.storeProfile?.storeName)}
        {fact("Contact person", store.contactName || owner?.storeProfile?.contactPerson)}
        {fact("Business email", store.contactEmail || owner?.storeProfile?.businessEmail)}
        {fact("Business phone", store.contactPhone || owner?.storeProfile?.businessPhone)}
        {fact("Address", [store.addressLine1, store.addressLine2, store.city, store.province, store.postalCode, store.country].filter(Boolean).join(", "))}
        {fact("Default pickup", store.defaultPickupAddressId ? "Configured — verify collection suitability" : "Not configured")}
        {fact("Store slug", store.slug)}
      </dl>
    </OperationalPanel>
    <OperationalPanel title="Account owner" description="Account identity and access facts. A seller's legal approval remains separately governed.">
      <dl className="grid gap-4 sm:grid-cols-2">
        {fact("Account owner", owner?.name)}
        {fact("Owner email", owner?.email)}
        {fact("Owner phone", owner?.phone)}
        {fact("User status", owner?.status)}
        {fact("Email verification", owner?.emailVerifiedAt ? date(owner.emailVerifiedAt) : "Not verified")}
        {fact("Account created", date(owner?.createdAt))}
      </dl>
    </OperationalPanel>
    <OperationalPanel title="Seller compliance and catalog" description="Account approval, independently verified seller identity, and product publication are separate operational controls.">
      <dl className="grid gap-4 sm:grid-cols-2">
        {fact("Legal seller", !canReviewSeller ? "Requires legal-document access" : legalSeller?.legalName ?? "Not independently approved")}
        {fact("Trading name", !canReviewSeller ? "Restricted" : legalSeller?.tradingName)}
        {fact("Registration reference", !canReviewSeller ? "Restricted" : legalSeller?.registrationReference)}
        {fact("VAT registration", !canReviewSeller ? "Restricted" : legalSeller?.vatRegistrationStatus)}
        {fact("Catalog offers", String(catalogOfferCount))}
        {fact("Published offers", String(publishedOfferCount))}
        {fact("Public storefront status", storefront?.publicStatus ?? "Not projected")}
        {fact("Delivery orders recorded", String(store.orderCount))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold">
        {canReviewSeller ? <Link href={`/admin/stores/${encodeURIComponent(id)}/seller-identity`} className="underline underline-offset-4">Review seller evidence</Link> : null}
        {canManagePricing ? <Link href={`/admin/pricing?storeId=${encodeURIComponent(id)}`} className="underline underline-offset-4">Store-specific delivery pricing ({negotiatedRateCount} active)</Link> : null}
        {admin.role === "SUPER_ADMIN" ? <Link href={`/admin/business-support/${encodeURIComponent(id)}`} className="underline underline-offset-4">Business support</Link> : null}
      </div>
    </OperationalPanel>
  </ProtectedPageFrame>;
}
