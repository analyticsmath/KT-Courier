"use client";

import { useState } from "react";
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

  const handleMobileSheetClose = () => {
    setMobileSheetOpen(false);
    setMobileServicesView(false);
  };

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
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
              aria-label="Cart"
              className={styles.utilLink}
              href="/cart"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <KtIconCart size={18} />
            </Link>
            <Link className={styles.quoteButton} href="/account/request-delivery">
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
              aria-label="Cart"
              className={styles.compactIconButton}
              href="/cart"
            >
              <KtIconCart size={20} />
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
                <KtIconBack size={18} />
                <span>Main menu</span>
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
                  href="/account/request-delivery"
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
