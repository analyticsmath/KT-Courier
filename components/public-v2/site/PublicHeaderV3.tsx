"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { KtIconMenu, KtIconCart } from "@/components/public-v2/graphics/KtIcons";
import { MobileSheet } from "@/components/public-v2/overlays";
import { HeaderScrollState } from "./HeaderScrollState";
import { DesktopPrimaryNavigation } from "./DesktopPrimaryNavigation";
import { ServicesAtlasMenu } from "./ServicesAtlasMenu";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./public-shell.module.css";

export function PublicHeaderV3() {
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const handleScrolledChange = useCallback((nextScrolled: boolean) => {
    setScrolled(nextScrolled);
  }, []);

  const headerClass = `${styles.header} ${
    !isHomepage || scrolled || servicesOpen ? styles.headerScrolled : ""
  }`;

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <HeaderScrollState className={styles.headerSentinel} onScrolledChange={handleScrolledChange} />
      <header className={headerClass} data-homepage={isHomepage || undefined} data-scrolled={scrolled || undefined}>
        <div className={styles.headerInner}>
          <Link aria-label="KT Couriers" className={styles.brandLink} href="/" onClick={() => setServicesOpen(false)}>
            <KtCouriersWordmark compactMark />
          </Link>

          <DesktopPrimaryNavigation
            onOpenServices={() => setServicesOpen((prev) => !prev)}
            servicesOpen={servicesOpen}
          />

          <div className={styles.headerUtilities}>
            <Link className={styles.utilLink} href="/join">
              Join
            </Link>
            <Link className={styles.utilLink} href="/login">
              Sign in
            </Link>
            <Link aria-label="Cart" className={styles.utilLink} href="/cart" style={{ display: "inline-flex", alignItems: "center" }}>
              <KtIconCart size={18} />
            </Link>
            <Link className={styles.quoteButton} href="/account/request-delivery">
              Get a quote
            </Link>
          </div>

          <div className={styles.compactTopBar}>
            <Link aria-label="Cart" className={styles.utilLink} href="/cart" style={{ padding: "8px 6px" }}>
              <KtIconCart size={20} />
            </Link>
            <Link className={styles.quoteButton} href="/account/request-delivery" style={{ padding: "7px 12px", fontSize: "0.825rem" }}>
              Quote
            </Link>
            <button
              aria-expanded={mobileSheetOpen}
              aria-label={mobileSheetOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileSheetOpen(true)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "6px" }}
              type="button"
            >
              <KtIconMenu size={22} />
            </button>
          </div>
        </div>

        <ServicesAtlasMenu onClose={() => setServicesOpen(false)} open={servicesOpen} />
      </header>

      <MobileSheet
        ariaLabel="KT Couriers site menu"
        closeOnBackdropClick
        description="Explore KT Couriers services, coverage and network."
        onOpenChange={setMobileSheetOpen}
        open={mobileSheetOpen}
        title="Menu"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "20px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href={marketplaceHref()}
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              Marketplace
            </Link>
            <Link
              href="/services"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              All Services
            </Link>
            <Link
              href="/services/parcel"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "0.95rem", color: "var(--kt-graphite)", paddingLeft: 12, textDecoration: "none" }}
            >
              Parcels & Documents
            </Link>
            <Link
              href="/services/business"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "0.95rem", color: "var(--kt-graphite)", paddingLeft: 12, textDecoration: "none" }}
            >
              Business & Store Delivery
            </Link>
            <Link
              href="/services/food"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "0.95rem", color: "var(--kt-graphite)", paddingLeft: 12, textDecoration: "none" }}
            >
              Food & Grocery
            </Link>
            <Link
              href="/services/freight"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "0.95rem", color: "var(--kt-graphite)", paddingLeft: 12, textDecoration: "none" }}
            >
              Freight & Heavy Moving
            </Link>
            <Link
              href="/coverage-areas"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)", marginTop: 8 }}
            >
              Coverage Areas
            </Link>
            <Link
              href="/join"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              Join the Network
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              About KT Couriers
            </Link>
            <Link
              href="/faq"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1.1rem", fontWeight: 560, textDecoration: "none", color: "var(--kt-carbon)" }}
            >
              Contact Support
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16, borderTop: "1px solid var(--kt-cool-200)" }}>
            <Link
              href="/login"
              onClick={() => setMobileSheetOpen(false)}
              style={{ fontSize: "1rem", fontWeight: 560, color: "var(--kt-carbon)", textDecoration: "none" }}
            >
              Sign in to account
            </Link>
            <Link
              className={styles.quoteButton}
              href="/account/request-delivery"
              onClick={() => setMobileSheetOpen(false)}
              style={{ justifyContent: "center", width: "100%" }}
            >
              Request delivery quote
            </Link>
          </div>
        </div>
      </MobileSheet>
    </>
  );
}
