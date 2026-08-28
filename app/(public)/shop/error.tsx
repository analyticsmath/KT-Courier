"use client";

import Link from "next/link";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { marketplaceHref } from "@/lib/public-marketplace/routes";

export default function StorefrontError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      aria-label="Marketplace source unavailable"
      className={styles.commerceRoot}
      id="storefront-content"
    >
      <div className={styles.commerceInner} style={{ padding: "5rem 0" }}>
        <h1 style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 560, margin: "0 0 16px" }}>
          The marketplace cannot load right now.
        </h1>
        <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", maxWidth: 600, margin: "0 0 24px" }}>
          Product, price, and store availability information is unavailable until the marketplace source responds.
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              backgroundColor: "var(--kt-carbon, #101210)",
              color: "var(--kt-white, #ffffff)",
              border: "none",
              fontWeight: 560,
              cursor: "pointer",
            }}
            type="button"
          >
            Try again
          </button>
          <Link className={styles.sectionDirectLink} href={marketplaceHref()}>
            Return to shop &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
