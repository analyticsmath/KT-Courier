"use client";

import { useState } from "react";
import { marketplaceSearchHref } from "@/lib/public-marketplace/routes";
import { KtIconSearch, KtIconTune, KtIconClose } from "@/components/public-v2/graphics/KtIcons";
import styles from "./commerce.module.css";

interface CommerceSearchCommandProps {
  action?: string;
  query?: string;
  placeholder?: string;
  hidden?: Array<{ name: string; value: string }>;
  className?: string;
  onToggleFilter?: () => void;
  showFilterButton?: boolean;
}

export function CommerceSearchCommand({
  action = marketplaceSearchHref(),
  query = "",
  placeholder = "Search products, stores or categories...",
  hidden = [],
  className = "",
  onToggleFilter,
  showFilterButton = false,
}: CommerceSearchCommandProps) {
  const [val, setVal] = useState(query);

  return (
    <form
      action={action}
      className={`${styles.searchCommandForm} ${className}`}
      role="search"
    >
      {hidden.map((field) => (
        <input
          key={`${field.name}:${field.value}`}
          name={field.name}
          type="hidden"
          value={field.value}
        />
      ))}
      <div className={styles.searchIconPrefix} aria-hidden="true">
        <KtIconSearch size={18} />
      </div>
      <label className="sr-only" htmlFor="commerce-search-input">
        Search the marketplace
      </label>
      <input
        aria-label="Search the marketplace"
        className={styles.searchCommandInput}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        id="commerce-search-input"
        maxLength={160}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      {val ? (
        <button
          type="button"
          aria-label="Clear search"
          className={styles.searchClearButton}
          onClick={() => setVal("")}
        >
          <KtIconClose size={16} />
        </button>
      ) : null}
      {showFilterButton ? (
        <button
          type="button"
          aria-label="Toggle filters"
          className={styles.searchFilterButton}
          onClick={() => {
            if (onToggleFilter) {
              onToggleFilter();
            } else if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("kt:open-filter-sheet"));
            }
          }}
        >
          <KtIconTune size={18} />
        </button>
      ) : null}
      <button
        aria-label="Submit search"
        className={styles.searchCommandButton}
        type="submit"
      >
        <span>Search</span>
      </button>
    </form>
  );
}
