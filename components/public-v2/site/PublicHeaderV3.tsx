"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import {
  KtIconMenu,
  KtIconCart,
  KtIconSearch,
  KtIconBack,
  KtIconArrowRight,
} from "@/components/public-v2/graphics/KtIcons";
import { MobileSheet } from "@/components/public-v2/overlays";
import { DesktopPrimaryNavigation } from "./DesktopPrimaryNavigation";
import { ServicesAtlasMenu, allServices } from "./ServicesAtlasMenu";
import { marketplaceHref, marketplaceSearchHref } from "@/lib/public-marketplace/routes";
import styles from "./public-shell.module.css";

export function PublicHeaderV3() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileServicesView, setMobileServicesView] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [headerTone, setHeaderTone] = useState<"light" | "dark">("light");

  const handleMobileSheetClose = () => {
    setMobileSheetOpen(false);
    setMobileServicesView(false);
  };

  // Sync live cart item count
  useEffect(() => {
    let active = true;
    const fetchCartCount = async () => {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.cart) {
          const totalItems = typeof data.cart.itemCount === "number"
            ? data.cart.itemCount
            : (data.cart.storeGroups || []).reduce(
                (total: number, group: { lines?: Array<{ quantity: number }> }) =>
                  total + (group.lines || []).reduce((sum, line) => sum + line.quantity, 0),
                0,
              );
          setCartCount(totalItems);
        }
      } catch {
        // Fallback silently if offline or unauthenticated
      }
    };

    fetchCartCount();

    const handleCartUpdated = () => {
      fetchCartCount();
    };

    window.addEventListener("kt-cart-updated", handleCartUpdated);
    return () => {
      active = false;
      window.removeEventListener("kt-cart-updated", handleCartUpdated);
    };
  }, []);

  // Dynamic contrast adaptation over dark/light scenes
  useEffect(() => {
    const evaluateContrast = () => {
      // The cinematic homepage publishes tone from its deterministic world owner.
      if (document.querySelector('[data-kt-motion-owned="director"]')) return;
      const darkSections = document.querySelectorAll(
        "[data-kt-contrast='dark'], [data-tone='dark'], [data-kt-header-contrast='dark']"
      );
      let isDarkUnderHeader = false;
      const headerThreshold = 72; // Header height in px

      for (let i = 0; i < darkSections.length; i++) {
        const rect = darkSections[i].getBoundingClientRect();
        if (rect.top <= headerThreshold && rect.bottom >= 36) {
          isDarkUnderHeader = true;
          break;
        }
      }

      setHeaderTone(isDarkUnderHeader ? "dark" : "light");
    };

    const handleCustomTone = (e: Event) => {
      const customEvent = e as CustomEvent<{ tone: "light" | "dark" }>;
      if (customEvent.detail?.tone) {
        setHeaderTone(customEvent.detail.tone);
      }
    };

    window.addEventListener("scroll", evaluateContrast, { passive: true });
    window.addEventListener("kt-header-tone", handleCustomTone);
    evaluateContrast();

    return () => {
      window.removeEventListener("scroll", evaluateContrast);
      window.removeEventListener("kt-header-tone", handleCustomTone);
    };
  }, []);

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header} data-tone={headerTone}>
        <div className={styles.headerInner}>
          <Link
            aria-label="KT Couriers"
            className={styles.brandLink}
            href="/"
            onClick={() => setServicesOpen(false)}
          >
            <KtCouriersWordmark compactMark />
          </Link>

          {/* Desktop Primary Navigation */}
          <DesktopPrimaryNavigation
            onOpenServices={() => setServicesOpen((prev) => !prev)}
            servicesOpen={servicesOpen}
          />

          {/* Desktop Utilities */}
          <div className={styles.headerUtilities}>
            <Link className={styles.utilLink} href="/join">
              Join
            </Link>
            <Link className={styles.utilLink} href="/login">
              Sign in
            </Link>
            <Link
              aria-label={`Cart with ${cartCount} items`}
              className={styles.utilLink}
              data-kt-cart-target="header"
              href="/cart"
              style={{ display: "inline-flex", alignItems: "center", position: "relative" }}
            >
              <KtIconCart size={18} />
              {cartCount > 0 && (
                <span aria-label={`${cartCount} items in cart`} className={styles.utilCartBadge}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            <Link className={styles.quoteButton} href="/services/pricing">
              Get a quote
            </Link>
          </div>

          {/* Compact Top Bar (Mobile / Tablet <= 1023px) */}
          <div className={styles.compactTopBar}>
            <Link
              aria-label="Search"
              className={styles.compactIconButton}
              href={marketplaceSearchHref()}
            >
              <KtIconSearch size={20} />
            </Link>
            <Link
              aria-label={`Cart with ${cartCount} items`}
              className={styles.compactIconButton}
              data-kt-cart-target="mobile-header"
              href="/cart"
              style={{ position: "relative" }}
            >
              <KtIconCart size={20} />
              {cartCount > 0 && (
                <span aria-label={`${cartCount} items in cart`} className={styles.utilCartBadge}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            <button
              aria-expanded={mobileSheetOpen}
              aria-label={mobileSheetOpen ? "Close menu" : "Open menu"}
              className={styles.compactIconButton}
              onClick={() => setMobileSheetOpen(true)}
              type="button"
            >
              <KtIconMenu size={22} />
            </button>
          </div>
        </div>

        {/* Desktop Service Index Plane */}
        <ServicesAtlasMenu
          onClose={() => setServicesOpen(false)}
          open={servicesOpen}
        />
      </header>

      {/* Mobile Menu Sheet */}
      <MobileSheet
        ariaLabel="Site navigation menu"
        closeOnBackdropClick
        description="Explore KT Couriers services, coverage and network."
        onOpenChange={(open) => {
          if (!open) handleMobileSheetClose();
          else setMobileSheetOpen(true);
        }}
        open={mobileSheetOpen}
        title={mobileServicesView ? "All Services" : "Navigation"}
      >
        <div className={styles.mobileMenuContainer}>
          {mobileServicesView ? (
            <div>
              <button
                className={styles.mobileBackButton}
                onClick={() => setMobileServicesView(false)}
                type="button"
              >
                <KtIconBack size={20} />
                <span style={{ fontWeight: 600 }}>Back to Main Menu</span>
              </button>

              <ul className={styles.mobileSubList}>
                {allServices.map((service) => (
                  <li key={service.id}>
                    <Link
                      className={styles.mobileSubRow}
                      href={service.href}
                      onClick={handleMobileSheetClose}
                    >
                      <span>{service.title}</span>
                      <KtIconArrowRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className={styles.mobileMenuMainList}>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href={marketplaceHref()}
                  onClick={handleMobileSheetClose}
                >
                  <span>Shop</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href="/services/pricing"
                  onClick={handleMobileSheetClose}
                >
                  <span>Send</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
              <li>
                <button
                  className={styles.mobileMenuRow}
                  onClick={() => setMobileServicesView(true)}
                  type="button"
                >
                  <span>Services</span>
                  <KtIconArrowRight size={16} />
                </button>
              </li>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href="/coverage-areas"
                  onClick={handleMobileSheetClose}
                >
                  <span>Coverage</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href="/services/business"
                  onClick={handleMobileSheetClose}
                >
                  <span>Business</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href="/join"
                  onClick={handleMobileSheetClose}
                >
                  <span>Join</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
              <li>
                <Link
                  className={styles.mobileMenuRow}
                  href="/login"
                  onClick={handleMobileSheetClose}
                >
                  <span>Sign in</span>
                  <KtIconArrowRight size={16} />
                </Link>
              </li>
            </ul>
          )}
        </div>
      </MobileSheet>
    </>
  );
}
