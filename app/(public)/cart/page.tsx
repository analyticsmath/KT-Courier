import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { CartExperience } from "@/components/public-v2/commerce/CartExperience";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";
import { resolveQaAcceptanceSessionContext } from "@/lib/qa-acceptance/access";

export const metadata: Metadata = {
  title: "Shopping Cart | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default async function MarketplaceCartPage() {
  // Activation is deployment configuration, not a build-time preview decision.
  await connection();
  const gate = evaluateMarketplaceCheckoutPublicGate();
  const user = await getCurrentUser().catch(() => null);
  const qaCtx = user ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null) : null;
  if (!gate.enabled && !qaCtx) {
    return <MarketplaceUnavailable routeContext="cart" />;
  }
  return (
    <>
      {qaCtx ? (
        <div
          className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] px-4 py-3 text-sm text-[var(--kt-public-text-primary)]"
          role="status"
        >
          <strong>QA Acceptance Lane (Paystack Test Mode)</strong> — Active run{" "}
          <span className="font-mono text-xs">{qaCtx.activeRunReference ?? "enrolled session"}</span>. Cart and orders stay isolated from live commercial accounts.{" "}
          <Link href="/shop/qa" className="font-semibold underline underline-offset-4">Back to QA Storefront</Link>
        </div>
      ) : null}
      <CartExperience />
    </>
  );
}
