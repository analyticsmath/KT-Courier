import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CommerceBreadcrumbs } from "@/components/public-v2/commerce/CommerceBreadcrumbs";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MARKETPLACE_ORDER_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { getMarketplaceDeliveryTracking, MarketplaceDeliveryTrackingError } from "@/lib/services/marketplace-delivery-tracking.service";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  title: "Order status | KT Couriers",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

async function loadTracking(input: Readonly<{ marketplaceOrderReference: string; customerUserId?: string; guestSecret?: string }>) {
  try { return await getMarketplaceDeliveryTracking(input); }
  catch (error) { if (error instanceof MarketplaceDeliveryTrackingError) return null; throw error; }
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLocaleLowerCase("en-ZA").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-ZA"));
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

  const confirmed = tracking.status === "CONFIRMED";
  return <main className={styles.commerceRoot} id="storefront-content">
    <div className={styles.commerceInner}>
      <CommerceBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: "Order status" }]} />
      <header className={styles.orderStatusIntro}>
        <span aria-hidden="true" className={styles.orderSuccessMark}><svg fill="none" viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg></span>
        <p className={styles.productTileBrand}>{confirmed ? "Order placed" : "Order progress"}</p>
        <h1 className={styles.commerceTitle}>{confirmed ? "Your order is confirmed" : "Order status"}</h1>
        <p className={styles.commerceLead}>{confirmed ? "Your order is grouped by store below. Fulfilment updates will appear here as they become available." : "The latest fulfilment and delivery progress for your order is shown below."}</p>
        <p className={styles.orderReference}>Order reference <span>{tracking.marketplaceOrderReference}</span></p>
      </header>
      <section aria-labelledby="order-store-groups" className={styles.orderStoreGroups}>
        <h2 id="order-store-groups">Store orders</h2>
        {tracking.storeOrders.map((storeOrder) => <article className={styles.orderStoreCard} key={storeOrder.storeOrderReference}>
          <header className={styles.orderStoreHeader}>
            <div><h3>{storeOrder.storeName}</h3><p>Store order reference · {storeOrder.storeOrderReference}</p></div>
            <span className={styles.orderStatusPill}>{statusLabel(storeOrder.deliveryStatus)}</span>
          </header>
          <ol className={styles.orderTimeline}>
            <li><span aria-hidden="true" /><div><strong>Store fulfilment</strong><p>{statusLabel(storeOrder.fulfilmentStatus)}</p></div></li>
            <li><span aria-hidden="true" /><div><strong>Delivery</strong><p>{statusLabel(storeOrder.deliveryStatus)}</p></div></li>
          </ol>
          <p className={styles.orderLocationNote}>{storeOrder.liveLocation
            ? `Courier location is available. Last update ${new Date(storeOrder.liveLocation.observedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}.`
            : "Courier location is not available at this stage."}</p>
        </article>)}
      </section>
      <div className={styles.orderStatusActions}><Link className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} href="/shop">Continue shopping</Link></div>
    </div>
  </main>;
}
