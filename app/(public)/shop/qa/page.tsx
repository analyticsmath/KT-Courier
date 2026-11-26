import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveQaAcceptanceSessionContext } from "@/lib/qa-acceptance/access";
import { listQaStorefrontStores } from "@/lib/services/storefront-catalog.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private QA Storefront | KT Couriers",
  robots: { index: false, follow: false },
};

export default async function QaPrivateStorefrontIndexPage() {
  const user = await getCurrentUser().catch(() => null);
  const qaCtx = user ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null) : null;
  if (!qaCtx) notFound();

  const stores = await listQaStorefrontStores();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6" id="storefront-content">
      <div
        className="rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] p-4 text-sm text-[var(--kt-public-text-primary)]"
        role="status"
      >
        <p className="font-semibold">Private QA Acceptance Storefront (Restricted Access)</p>
        <p className="mt-1 text-[var(--kt-public-text-muted)]">
          Visible only to enrolled QA acceptance accounts. Run reference:{" "}
          <span className="font-mono text-xs">{qaCtx.activeRunReference ?? "enrolled session"}</span>. All orders route to Paystack test keys and non-withdrawable isolated wallets.
        </p>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--kt-public-text-primary)]">QA Demonstration Stores</h1>
          <p className="mt-1 text-sm text-[var(--kt-public-text-muted)]">
            Select an enrolled, reviewed QA storefront to inspect trading hours, products, and end-to-end test checkout.
          </p>
        </div>
        <Link
          href="/cart"
          className="rounded-lg border border-[var(--kt-public-border-control)] bg-[var(--kt-public-surface-primary)] px-4 py-2 text-sm font-semibold text-[var(--kt-public-text-primary)]"
        >
          View Cart
        </Link>
      </header>

      {stores.length === 0 ? (
        <section className="rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-primary)] p-6 text-sm text-[var(--kt-public-text-secondary)]">
          <p className="font-semibold text-[var(--kt-public-text-primary)]">No published QA storefronts ready yet.</p>
          <p className="mt-2">
            Complete vendor onboarding, approved seller legal identity, trading hours, active commission plan, at least one published sellable product with stock, and dual-control Store Checkout Certification to publish into this private lane.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((store) => (
            <article key={store.reference} className="flex flex-col justify-between rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-primary)] p-5 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[var(--kt-public-text-primary)]">{store.name}</h2>
                  <span className="rounded-full border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] px-2.5 py-0.5 text-xs font-semibold text-[var(--kt-public-text-primary)]">
                    QA Private
                  </span>
                </div>
                {store.description ? <p className="text-sm text-[var(--kt-public-text-muted)]">{store.description}</p> : null}
                <p className="text-xs text-[var(--kt-public-text-muted)]">
                  {store.publishedOfferCount} published {store.publishedOfferCount === 1 ? "product" : "products"} ·{" "}
                  {store.scheduleStatus === "TRADING_HOURS_CONFIGURED" ? "Trading hours configured" : "Trading hours not configured"}
                </p>
                {store.operatingHoursSummary ? (
                  <p className="rounded-md bg-[var(--kt-public-surface-secondary)] p-2 text-xs text-[var(--kt-public-text-muted)]">{store.operatingHoursSummary}</p>
                ) : null}
              </div>
              <div className="mt-4">
                <Link
                  href={`/shop/qa/stores/${encodeURIComponent(store.slug)}`}
                  className="inline-flex items-center rounded-lg bg-[var(--kt-public-action-primary)] px-4 py-2 text-sm font-semibold text-[var(--kt-public-text-inverse)]"
                >
                  Open QA Storefront
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
