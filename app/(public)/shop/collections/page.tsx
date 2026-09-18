import type { Metadata } from "next";
import Link from "next/link";
import { listStorefrontCategories } from "@/lib/services/storefront-catalog.service";

export const metadata: Metadata = {
  title: "Curated Collections | KT Couriers Marketplace",
  description: "Browse curated marketplace collections from South African local stores connected to KT Couriers.",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const categories = await listStorefrontCategories();

  return (
    <div className="min-h-[85vh] bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-12 px-6 md:px-12 max-w-6xl mx-auto">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="text-xs font-mono uppercase tracking-wider text-[var(--kt-road-grey)] mb-8"
      >
        <Link href="/shop" className="hover:underline">
          Shop
        </Link>{" "}
        / <span className="text-[var(--kt-asphalt)] font-bold">Collections</span>
      </nav>

      {/* Header */}
      <div className="mb-12 border-b border-[var(--kt-concrete)]/50 pb-8">
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Curated Collections
        </h1>
        <p className="text-lg text-[var(--kt-road-grey)] max-w-xl">
          Seasonal edits, regional merchant showcases, and curated local provisions.
        </p>
      </div>

      {/* Human Empty State */}
      <div className="py-16 px-8 sm:px-12 bg-white border border-[var(--kt-concrete)] text-center max-w-2xl mx-auto">
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
          Marketplace Collections
        </span>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          Nothing has been added here yet.
        </h2>
        <p className="text-base text-[var(--kt-road-grey)] max-w-md mx-auto mb-8 leading-relaxed">
          Browse the marketplace while new collections are being prepared.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] font-bold text-xs uppercase tracking-wider hover:bg-[#23272B] transition-colors"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/shop/categories"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-[var(--kt-asphalt)] text-[var(--kt-asphalt)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--kt-asphalt)] hover:text-[var(--kt-freight-paper)] transition-colors"
          >
            All Categories
          </Link>
        </div>
      </div>

      {/* Active Category Shortcuts */}
      {categories.length > 0 && (
        <div className="mt-16 pt-12 border-t border-[var(--kt-concrete)]/40">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--kt-road-grey)] mb-6">
            Featured Marketplace Categories
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {categories.slice(0, 8).map((cat) => (
              <Link
                key={cat.reference}
                href={`/shop/categories/${cat.path}`}
                className="p-4 bg-white border border-[var(--kt-concrete)]/60 hover:border-[var(--kt-asphalt)] transition-colors block"
              >
                <span className="font-display font-bold text-sm block mb-1">
                  {cat.name}
                </span>
                <span className="text-xs text-[var(--kt-road-grey)]">
                  {cat.productCount} {cat.productCount === 1 ? "item" : "items"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
