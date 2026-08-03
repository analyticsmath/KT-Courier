import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import styles from "./marketplace.module.css";

export type MarketplaceRouteContext =
  | "cart"
  | "checkout"
  | "confirmation";

const routeCopy: Record<MarketplaceRouteContext, Readonly<{ eyebrow: string; title: string; description: string }>> = {
  cart: {
    eyebrow: "Marketplace cart unavailable",
    title: "A marketplace cart is not available.",
    description: "This page does not load items, totals, delivery charges, discounts, or a checkout action while public marketplace shopping is unavailable.",
  },
  checkout: {
    eyebrow: "Checkout unavailable",
    title: "Marketplace checkout is not currently available.",
    description: "Address collection, payment, inventory reservation, and order review remain governed by the canonical checkout flow and are not presented here.",
  },
  confirmation: {
    eyebrow: "Order confirmation boundary",
    title: "Order confirmation is available only from an authorized order flow.",
    description: "A browser visit to this route does not create, reveal, or confirm an order. Customer and guest access remain governed by the existing order authority.",
  },
};

export function MarketplaceUnavailable({ routeContext = "cart" }: { routeContext?: MarketplaceRouteContext }) {
  const copy = routeCopy[routeContext];
  const isConfirmation = routeContext === "confirmation";

  return (
    <main className={styles.unavailablePage} id="storefront-content">
      <div className={styles.inner}>
        <PublicBreadcrumbs className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Marketplace", href: "/shop" }, { label: copy.eyebrow }]} />
        <section aria-labelledby="marketplace-unavailable-title" className={styles.unavailablePanel}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="marketplace-unavailable-title">{copy.title}</h1>
          <p className={styles.lead}>{copy.description}</p>
          <p className={styles.quietNote}>Store and fulfilment capabilities remain part of the wider KT Couriers platform. Use a verified route for the work that is available today.</p>
          <div className={styles.actionGroup}>
            <Link className={styles.primaryAction} href={isConfirmation ? "/account/orders" : "/shop"}>{isConfirmation ? "View account order updates" : "Marketplace availability"}</Link>
            {!isConfirmation ? <Link className={styles.secondaryAction} href="/join#stores">Store participation</Link> : null}
            <Link className={styles.textAction} href={routeContext === "cart" || routeContext === "checkout" ? "/contact" : "/account/request-delivery"}>{routeContext === "cart" || routeContext === "checkout" ? "Contact support" : "Request a courier delivery"}<span aria-hidden="true"> →</span></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
