"use client";

import { useState } from "react";
import Link from "next/link";
import type { StorefrontFilterInput } from "@/lib/storefront/search/storefront-filter-url";
import type { StorefrontFacet } from "@/lib/storefront/storefront-types";
import { marketplaceListingHref, marketplaceHref, type MarketplaceListingRoute } from "@/lib/public-marketplace/routes";
import { MobileSheet } from "@/components/public-v2/overlays";
import styles from "./commerce.module.css";

interface MobileFilterSheetProps {
  facets: readonly StorefrontFacet[];
  filters: StorefrontFilterInput;
  route: MarketplaceListingRoute;
  resultCount: number;
}

export function MobileFilterSheet({
  facets,
  filters,
  route,
  resultCount,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.mobileFilterTriggerBar}>
        <span style={{ fontSize: "0.9rem", color: "var(--kt-graphite, #303532)" }}>
          {resultCount} {resultCount === 1 ? "product" : "products"}
        </span>

        <button
          className={styles.mobileFilterOpenButton}
          onClick={() => setOpen(true)}
          type="button"
        >
          <svg
            fill="none"
            height={16}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width={16}
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filter & Sort</span>
        </button>
      </div>

      <MobileSheet
        ariaLabel="Filter and sort products"
        closeOnBackdropClick
        description="Select criteria to narrow product results."
        onOpenChange={setOpen}
        open={open}
        title="Filter & Sort"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: "16px 0 32px" }}>
          {facets.map((facet) => (
            <div className={styles.facetGroup} key={facet.code}>
              <h3 className={styles.facetHeading}>{facet.label}</h3>
              <ul className={styles.facetList}>
                {facet.values.map((val: { value: string; label: string; count: number; selected: boolean }) => {
                  const nextHref = marketplaceListingHref(route, {
                    ...filters,
                    facets: {
                      ...(filters.facets ?? {}),
                      [facet.code]: val.selected
                        ? (filters.facets?.[facet.code] ?? []).filter((v) => v !== val.value)
                        : [...(filters.facets?.[facet.code] ?? []), val.value],
                    },
                  }) ?? marketplaceHref();

                  return (
                    <li key={val.value}>
                      <Link
                        className={styles.facetRowLink}
                        data-selected={val.selected ? "true" : undefined}
                        href={nextHref}
                        onClick={() => setOpen(false)}
                      >
                        <span>{val.label}</span>
                        <span className={styles.facetCount}>{val.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <button
            onClick={() => setOpen(false)}
            style={{
              padding: "14px 20px",
              backgroundColor: "var(--kt-carbon, #101210)",
              color: "var(--kt-white, #ffffff)",
              border: "none",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
              marginTop: 16,
            }}
            type="button"
          >
            Apply filters
          </button>
        </div>
      </MobileSheet>
    </>
  );
}
