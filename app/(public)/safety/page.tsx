import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Safety Information",
  description: "Safety and operational policy information for KT Couriers.",
  route: "/safety",
  noindex: true,
});

export default function SafetyPage() {
  return (
    <main style={{ padding: "clamp(36px, 5vw, 64px) var(--kt-grid-inset, 32px) clamp(60px, 8vw, 100px)", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 28 }}>
        <PublicBreadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Safety & Operations" }]}
        />
      </div>

      <header style={{ marginBottom: 48, maxWidth: 840 }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--kt-red, #d83a2e)" }}>
          Operational Standards
        </span>
        <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", fontWeight: 560, letterSpacing: "-0.035em", color: "var(--kt-carbon, #101210)", margin: "12px 0 16px", lineHeight: 1.02 }}>
          Safety & Chain of Custody.
        </h1>
        <p style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)", color: "var(--kt-muted, #5f6763)", lineHeight: 1.5, margin: 0 }}>
          Operating standards, coordinate verification, and chain-of-custody protocols for courier transit and marketplace fulfilment across South Africa.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 48 }}>
        <div style={{ padding: 28, backgroundColor: "var(--kt-white, #ffffff)", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 6 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--kt-carbon, #101210)", margin: "0 0 10px" }}>
            1. Coordinate Verification
          </h2>
          <p style={{ fontSize: "0.92rem", color: "var(--kt-graphite, #303532)", lineHeight: 1.5, margin: 0 }}>
            Every delivery request requires authenticated collection and dropoff coordinates within verified service regions before dispatch assignment.
          </p>
        </div>

        <div style={{ padding: 28, backgroundColor: "var(--kt-white, #ffffff)", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 6 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--kt-carbon, #101210)", margin: "0 0 10px" }}>
            2. Chain of Custody
          </h2>
          <p style={{ fontSize: "0.92rem", color: "var(--kt-graphite, #303532)", lineHeight: 1.5, margin: 0 }}>
            Orders transition through strictly recorded status milestones: staged by merchant, collected by verified courier, in transit, and confirmed at dropoff.
          </p>
        </div>

        <div style={{ padding: 28, backgroundColor: "var(--kt-white, #ffffff)", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 6 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--kt-carbon, #101210)", margin: "0 0 10px" }}>
            3. Prohibited & Regulated Goods
          </h2>
          <p style={{ fontSize: "0.92rem", color: "var(--kt-graphite, #303532)", lineHeight: 1.5, margin: 0 }}>
            Hazardous chemicals, unsealed flammables, illegal contraband, and unapproved medical substances are strictly excluded from network courier transit.
          </p>
        </div>
      </section>

      <section style={{ padding: "32px 36px", backgroundColor: "var(--kt-cool-050, #f8f9f8)", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--kt-carbon, #101210)", margin: "0 0 6px" }}>
            Have a specialized safety or dispatch query?
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--kt-muted, #5f6763)", margin: 0 }}>
            Our operations team can assist with high-value item coordination and transport requirements.
          </p>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: "var(--kt-carbon, #101210)",
              color: "var(--kt-white, #ffffff)",
              padding: "10px 20px",
              fontSize: "0.9rem",
              fontWeight: 600,
              textDecoration: "none",
              borderRadius: 4,
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
              fontSize: "0.9rem",
              fontWeight: 600,
              textDecoration: "none",
              padding: "10px 16px",
              border: "1px solid var(--kt-cool-200, #dde1e0)",
              backgroundColor: "var(--kt-white, #ffffff)",
              borderRadius: 4,
            }}
          >
            Delivery Services &rarr;
          </Link>
        </div>
      </section>
    </main>
  );
}
