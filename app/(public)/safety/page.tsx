import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Safety standards",
  description: "Safety, verification, and handling standards for KT Couriers.",
  route: "/safety",
  noindex: true,
});

export default function SafetyPage() {
  return (
    <main style={{ padding: "clamp(36px, 6vw, 72px) var(--kt-grid-inset, 32px) clamp(60px, 8vw, 100px)", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <PublicBreadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Safety" }]}
        />
      </div>

      <div style={{ borderLeft: "3px solid var(--kt-carbon, #101210)", paddingLeft: 24, marginTop: 32 }}>
        <h1 style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.6rem)", fontWeight: 560, letterSpacing: "-0.03em", color: "var(--kt-carbon, #101210)", margin: "0 0 16px" }}>
          Safety & Verification Standards.
        </h1>
        <p style={{ fontSize: "1.1rem", color: "var(--kt-muted, #5f6763)", lineHeight: 1.5, margin: "0 0 24px", maxWidth: 700 }}>
          Operating, vehicle, insurance, and physical custody handoff criteria are verified through authorized merchant and driver onboarding protocols.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8 }}>
          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: "var(--kt-carbon, #101210)",
              color: "var(--kt-white, #ffffff)",
              padding: "12px 24px",
              fontSize: "0.95rem",
              fontWeight: 560,
              textDecoration: "none",
            }}
          >
            Contact Operations
          </Link>
          <Link
            href="/services"
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: "var(--kt-carbon, #101210)",
              fontSize: "0.95rem",
              fontWeight: 540,
              textDecoration: "none",
              paddingBottom: 2,
              borderBottom: "1px solid var(--kt-cool-300, #dde1e0)",
            }}
          >
            Explore Services &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
