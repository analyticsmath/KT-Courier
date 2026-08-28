import Link from "next/link";
import { KtIconCart } from "@/components/public-v2/graphics/KtIcons";
import { marketplaceHref, marketplaceSearchHref } from "@/lib/public-marketplace/routes";
import styles from "@/components/public-v2/commerce/commerce.module.css";

export type MarketplaceRouteContext =
  | "storefront"
  | "cart"
  | "checkout"
  | "confirmation";

const routeCopy: Record<
  MarketplaceRouteContext,
  Readonly<{ title: string; description: string }>
> = {
  storefront: {
    title: "Marketplace is preparing for launch",
    description:
      "Public catalog items are currently being loaded. Check back soon or contact our support team.",
  },
  cart: {
    title: "Online checkout is not active yet",
    description:
      "Online purchasing and cart management are not enabled on this public preview. Product and merchant browsing remain open.",
  },
  checkout: {
    title: "Checkout is currently inactive",
    description:
      "Online order placement is not active on this public preview. You can continue browsing local merchants and catalog items.",
  },
  confirmation: {
    title: "Order lookup is available from active orders",
    description:
      "Order confirmations are accessible directly via authorized order links or account order history.",
  },
};

export function MarketplaceUnavailable({
  routeContext = "cart",
}: {
  routeContext?: MarketplaceRouteContext;
}) {
  const copy = routeCopy[routeContext];
  const isConfirmation = routeContext === "confirmation";

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner} style={{ padding: "5rem 0 8rem" }}>
        <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "var(--kt-cool-100, #eceeee)",
              color: "var(--kt-carbon, #101210)",
            }}
          >
            <KtIconCart size={24} />
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 3.5vw, 3.2rem)",
              fontWeight: 560,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            {copy.title}
          </h1>

          <p
            style={{
              fontSize: "1.05rem",
              color: "var(--kt-graphite, #303532)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {copy.description}
          </p>

          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              className={styles.enterStoreButton}
              href={isConfirmation ? "/account/orders" : marketplaceHref()}
            >
              {isConfirmation ? "View Orders" : "Browse Marketplace"}
            </Link>

            <Link className={styles.sectionDirectLink} href={marketplaceSearchHref()}>
              Search Products &rarr;
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
