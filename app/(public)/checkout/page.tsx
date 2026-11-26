import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutExperience } from "@/components/public-v2/commerce/CheckoutExperience";
import { MarketplaceUnavailable } from "@/components/public-v2/marketplace";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { evaluateMarketplaceCheckoutPublicGate } from "@/lib/marketplace-checkout/production-lock";
import { resolveQaAcceptanceSessionContext } from "@/lib/qa-acceptance/access";

export const metadata: Metadata = {
  title: "Secure Checkout | KT Couriers Marketplace",
  ...noIndexPublicMetadata,
  robots: { index: false, follow: true },
};

export default async function MarketplaceCheckoutPage() {
  await connection();
  const gate = evaluateMarketplaceCheckoutPublicGate();
  const user = await getCurrentUser().catch(() => null);
  const qaCtx = user ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null) : null;
  if (!gate.enabled && !qaCtx) {
    return <MarketplaceUnavailable routeContext="checkout" />;
  }
  return (
    <>
      {qaCtx ? (
        <div
          className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] px-4 py-3 text-sm text-[var(--kt-public-text-primary)]"
          role="status"
        >
          <strong>QA Acceptance Lane (Paystack Test Mode)</strong> — Active run{" "}
          <span className="font-mono text-xs">{qaCtx.activeRunReference ?? "enrolled session"}</span>. Transactions route strictly via Paystack sandbox credentials into non-withdrawable isolated wallets.{" "}
          <Link href="/shop/qa" className="font-semibold underline underline-offset-4">Back to QA Storefront</Link>
        </div>
      ) : null}
      <Suspense fallback={<div style={{ padding: "4rem 0", textAlign: "center" }}>Loading checkout...</div>}>
        <CheckoutExperience />
      </Suspense>
    </>
  );
}
