"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MobileSheet } from "@/components/public-v2/overlays";
import { HeaderScrollState } from "./HeaderScrollState";
import { PublicNavigation } from "./PublicNavigation";
import { anonymousTracking } from "./tracking-copy";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import styles from "./public-site-shell.module.css";

export function PublicHeaderV2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const handleScrolledChange = useCallback((nextScrolled: boolean) => setScrolled(nextScrolled), []);

  return (
    <>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <HeaderScrollState className={styles.headerSentinel} onScrolledChange={handleScrolledChange} />
      <header className={styles.header} data-scrolled={scrolled || undefined}>
        <div className={styles.headerInner}>
          <Link aria-label="KT Couriers" className={styles.wordmark} href="/">
            <KtCouriersWordmark compactMark />
          </Link>

          <PublicNavigation />

          <div className={styles.headerActions}>
            <Link className={styles.trackLink} href={anonymousTracking.href}>
              {anonymousTracking.actionLabel}
            </Link>
            <Link className={styles.accountLink} href="/login">
              Sign in
            </Link>
            <Link className={styles.quoteLink} href="/account/request-delivery">
              Get a quote
            </Link>
          </div>

          <div className={styles.mobileActions}>
            <Link aria-label="Get a quote" className={styles.mobileQuote} href="/account/request-delivery">
              Quote
            </Link>
            <button
              aria-controls="kt-public-mobile-navigation"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileSheet
        ariaLabel="Mobile navigation"
        closeOnBackdropClick
        description="Use these links to explore KT Couriers."
        onOpenChange={setMenuOpen}
        open={menuOpen}
        title="KT Couriers"
      >
        <div id="kt-public-mobile-navigation" className={styles.mobileSheetContent}>
          <PublicNavigation mobile onNavigate={() => setMenuOpen(false)} />
          <div className={styles.mobileSheetActions}>
            <Link href={anonymousTracking.href} onClick={() => setMenuOpen(false)}>
              {anonymousTracking.actionLabel}
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)}>
              Sign in
            </Link>
            <Link className={styles.quoteLink} href="/account/request-delivery" onClick={() => setMenuOpen(false)}>
              Get a quote
            </Link>
          </div>
        </div>
      </MobileSheet>
    </>
  );
}
