import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import styles from "@/components/public-v2/marketplace/marketplace.module.css";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MARKETPLACE_ORDER_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { getMarketplaceDeliveryTracking, MarketplaceDeliveryTrackingError } from "@/lib/services/marketplace-delivery-tracking.service";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Order confirmation access",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

async function loadTracking(input: Readonly<{ marketplaceOrderReference: string; customerUserId?: string; guestSecret?: string }>) {
  try {
    return await getMarketplaceDeliveryTracking(input);
  } catch (error) {
    if (error instanceof MarketplaceDeliveryTrackingError) return null;
    throw error;
  }
}

/** Owner-scoped delivery tracking. A URL alone never discloses marketplace data. */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const { publicReference } = await params;
  const user = await getCurrentUser();
  const customerUserId = user?.role === "CUSTOMER" ? user.id : undefined;
  const guestSecret = customerUserId ? undefined : (await cookies()).get(MARKETPLACE_ORDER_COOKIE)?.value;
  if (!customerUserId && !guestSecret) return <MarketplaceUnavailable routeContext="confirmation" />;
  const tracking = await loadTracking({ marketplaceOrderReference: publicReference, customerUserId, guestSecret });
  if (!tracking) return <MarketplaceUnavailable routeContext="confirmation" />;
  return <main className={styles.unavailablePage} id="storefront-content">
      <div className={styles.inner}>
        <PublicBreadcrumbs className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Marketplace", href: "/shop" }, { label: "Order tracking" }]} />
        <section aria-labelledby="marketplace-tracking-title" className={styles.unavailablePanel}>
          <p className={styles.eyebrow}>Marketplace delivery tracking</p>
          <h1 id="marketplace-tracking-title">Order progress</h1>
          <p className={styles.lead}>Current fulfilment and delivery status for {tracking.marketplaceOrderReference}. Live location, when available, is approximate and shown only while a courier is actively carrying an order.</p>
          <ul className={styles.conceptGrid} aria-label="Store order delivery progress">
            {tracking.storeOrders.map((storeOrder) => <li key={storeOrder.storeOrderReference} className={styles.routeComposition}>
              <p className={styles.statusLabel}>{storeOrder.deliveryStatus.replaceAll("_", " ")}</p>
              <div>
                <h2>{storeOrder.storeOrderReference}</h2>
                <p>Fulfilment: {storeOrder.fulfilmentStatus.replaceAll("_", " ")}</p>
                {storeOrder.liveLocation
                  ? <p>Approximate courier location: {storeOrder.liveLocation.latitude.toFixed(2)}, {storeOrder.liveLocation.longitude.toFixed(2)} · updated {storeOrder.liveLocation.observedAt}</p>
                  : <p>Courier location is not shown at this stage.</p>}
              </div>
            </li>)}
          </ul>
        </section>
      </div>
    </main>;
}
