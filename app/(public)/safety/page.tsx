import Link from "next/link";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Safety information",
  description: "Public safety information publication status for KT Couriers.",
  route: "/safety",
  noindex: true,
});

/** Safety, insurance, and operating commitments require business authority before publication. */
export default function SafetyPage() {
  return (
    <main className="container-public py-16 sm:py-24">
      <div className="max-w-2xl border-l-2 border-[var(--kt-public-signal)] pl-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--kt-public-signal)]">Information in preparation</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--kt-public-text-primary)]">Safety information is being prepared for publication.</h1>
        <p className="mt-4 leading-7 text-[var(--kt-public-text-secondary)]">Specific operating, insurance, verification, and handoff statements are not published here until their supporting business authority is confirmed.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center bg-[var(--kt-public-signal)] px-4 text-sm font-semibold text-white" href="/contact">Contact KT Couriers</Link>
          <Link className="inline-flex min-h-11 items-center border border-[var(--kt-public-text-primary)] px-4 text-sm font-semibold" href="/services">Explore services</Link>
        </div>
      </div>
    </main>
  );
}
