import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { marketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";

export default async function MarketplaceCheckoutAdminPage() {
  await requireAdminPagePermission(PERMISSIONS.MARKETPLACE_CHECKOUT_READ, "/admin");
  const ready = marketplaceCheckoutProductionReady();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Marketplace operations" title="Marketplace checkout" description="Protected administration reference for source-backed checkout operations." />
    <OperationalPanel title="Implementation state" description="No activation, transaction creation, payment operation, or settlement action is provided from this route.">
      {!ready ? <ProtectedState kind="locked" title="Marketplace checkout is not available for production use" description="The checkout workflow remains behind its existing consolidated-validation production lock. This administration route intentionally exposes no activation control, transaction evidence, provider detail, or payment secret." /> : <ProtectedState kind="unavailable" title="Checkout administration detail is unavailable" description="The current route tree contains no dedicated safe checkout-record presentation. Existing protected API authority and navigation remain unchanged." />}
    </OperationalPanel>
  </ProtectedPageFrame>;
}
