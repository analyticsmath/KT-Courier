"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import {
  marketplaceCategoryHref,
  marketplaceProductHref,
  marketplaceSearchHref,
  marketplaceStoreHref,
} from "@/lib/public-marketplace/routes";
import { KtIconSearch, KtIconTune, KtIconClose } from "@/components/public-v2/graphics/KtIcons";
import { storefrontCategoryMediaSrc } from "@/lib/storefront/category-media";
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

type SuggestionPayload = {
  products: Array<{
    productReference: string;
    productSlug: string;
    title: string;
    variantReference: string;
    brandName?: string;
    primaryMedia?: { publicReference: string; alt: string };
  }>;
  categories: Array<{ reference: string; path: string; name: string; imageReference?: string }>;
  stores: Array<{ reference: string; slug: string; name: string; logoMediaReference?: string }>;
  brands: Array<{ reference: string; name: string }>;
};

type SuggestionEntry = {
  key: string;
  group: string;
  title: string;
  detail?: string;
  href: string;
  mediaReference?: string;
  mediaSrc?: string;
  mediaAlt?: string;
};

export function CommerceSearchCommand({
  action = marketplaceSearchHref(),
  query = "",
  placeholder = "Search products, stores or categories...",
  hidden = [],
  className = "",
  onToggleFilter,
  showFilterButton = false,
}: CommerceSearchCommandProps) {
  const router = useRouter();
  const id = useId();
  const [val, setVal] = useState(query);
  const [focused, setFocused] = useState(false);
  const [payload, setPayload] = useState<SuggestionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmed = val.trim();
  const listId = `${id}-suggestions`;

  useEffect(() => {
    // The route query is the canonical value after a search navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVal(query);
    setActiveIndex(-1);
    setPayload(null);
    setFailed(false);
  }, [query]);

  useEffect(() => {
    if (!focused || trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/storefront/search/suggestions?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Suggestions are unavailable.");
        setPayload(await response.json() as SuggestionPayload);
      } catch {
        if (!controller.signal.aborted) {
          setPayload(null);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [focused, trimmed]);

  const groups = useMemo(() => {
    if (!trimmed) return [] as Array<{ label: string; entries: SuggestionEntry[] }>;
    const result: Array<{ label: string; entries: SuggestionEntry[] }> = [{
      label: "Search",
      entries: [{ key: "query", group: "Search", title: `Search for “${trimmed}”`, detail: "All matching products and stores", href: marketplaceSearchHref({ q: trimmed }) }],
    }];
    const products = (payload?.products ?? []).flatMap((product) => {
      const href = marketplaceProductHref(product.productSlug, product.productReference);
      return href ? [{ key: `product:${product.productReference}`, group: "Products", title: product.title, ...(product.brandName ? { detail: product.brandName } : {}), href, ...(product.primaryMedia ? { mediaReference: product.primaryMedia.publicReference, mediaAlt: product.primaryMedia.alt } : {}) }] : [];
    });
    const categories = (payload?.categories ?? []).flatMap((category) => {
      const href = marketplaceCategoryHref(category.path);
      const mediaSrc = storefrontCategoryMediaSrc(category.imageReference);
      return href ? [{ key: `category:${category.reference}`, group: "Categories", title: category.name, href, ...(mediaSrc ? { mediaSrc, mediaAlt: category.name } : {}) }] : [];
    });
    const stores = (payload?.stores ?? []).flatMap((store) => {
      const href = marketplaceStoreHref(store.slug);
      return href ? [{ key: `store:${store.reference}`, group: "Stores", title: store.name, href, ...(store.logoMediaReference ? { mediaReference: store.logoMediaReference, mediaAlt: "" } : {}) }] : [];
    });
    const brands = (payload?.brands ?? []).map((brand) => ({
      key: `brand:${brand.reference}`,
      group: "Brands",
      title: brand.name,
      detail: "Browse matching products",
      href: marketplaceSearchHref({ q: brand.name }),
    }));
    for (const [label, entries] of [["Products", products], ["Categories", categories], ["Stores", stores], ["Brands", brands]] as const) {
      if (entries.length) result.push({ label, entries });
    }
    return result;
  }, [payload, trimmed]);
  const entries = groups.flatMap((group) => group.entries);
  const open = focused && trimmed.length >= 2;

  function choose(entry: SuggestionEntry) {
    setFocused(false);
    setActiveIndex(-1);
    router.push(entry.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setFocused(false);
      setActiveIndex(-1);
    } else if (event.key === "ArrowDown" && open && entries.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % entries.length);
    } else if (event.key === "ArrowUp" && open && entries.length) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? entries.length - 1 : current - 1));
    } else if (event.key === "Enter" && open && activeIndex >= 0 && entries[activeIndex]) {
      event.preventDefault();
      choose(entries[activeIndex]);
    }
  }

  return (
    <div
      className={styles.searchCommandShell}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setActiveIndex(-1);
        }
      }}
    >
      <form action={action} className={`${styles.searchCommandForm} ${className}`} role="search">
        {hidden.map((field) => <input key={`${field.name}:${field.value}`} name={field.name} type="hidden" value={field.value} />)}
        <div className={styles.searchIconPrefix} aria-hidden="true"><KtIconSearch size={18} /></div>
        <label className="sr-only" htmlFor={`${id}-input`}>Search the marketplace</label>
        <input
          aria-label="Search the marketplace"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          aria-haspopup="listbox"
          className={styles.searchCommandInput}
          id={`${id}-input`}
          maxLength={160}
          name="q"
          onChange={(event) => { setVal(event.target.value); setActiveIndex(-1); setPayload(null); setLoading(false); setFailed(false); }}
          onFocus={() => { setFocused(true); setPayload(null); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="search"
          value={val}
        />
        {val ? <button type="button" aria-label="Clear search" className={styles.searchClearButton} onClick={() => { setVal(""); setActiveIndex(-1); }}><KtIconClose size={16} /></button> : null}
        {showFilterButton ? <button type="button" aria-label="Focus filters" className={styles.searchFilterButton} onClick={() => {
          if (onToggleFilter) onToggleFilter();
          else if (typeof window !== "undefined") {
            const desktop = window.matchMedia("(min-width: 1024px)").matches;
            window.dispatchEvent(new CustomEvent(desktop ? "kt:focus-desktop-filters" : "kt:open-filter-sheet"));
          }
        }}><KtIconTune size={18} /></button> : null}
        <button aria-label="Submit search" className={styles.searchCommandButton} type="submit"><span>Search</span></button>
      </form>
      {open ? <div className={styles.searchSuggestionPanel}>
        <div id={listId} role="listbox" aria-label="Search suggestions" aria-busy={loading}>
          {groups.map((group, groupIndex) => {
            const preceding = groups.slice(0, groupIndex).reduce((count, item) => count + item.entries.length, 0);
            return <div className={styles.searchSuggestionGroup} key={group.label} role="group" aria-label={group.label}>
              <p className={styles.searchSuggestionHeading} role="presentation">{group.label}</p>
              {group.entries.map((entry, entryIndex) => {
                const optionIndex = preceding + entryIndex;
                return <button
                  aria-selected={activeIndex === optionIndex}
                  className={`${styles.searchSuggestionOption} ${activeIndex === optionIndex ? styles.searchSuggestionOptionActive : ""}`}
                  id={`${listId}-option-${optionIndex}`}
                  key={entry.key}
                  onClick={() => choose(entry)}
                  onMouseMove={() => setActiveIndex(optionIndex)}
                  role="option"
                  type="button"
                >
                  {entry.mediaSrc || entry.mediaReference ? <span className={styles.searchSuggestionMedia}><Image alt={entry.mediaAlt ?? ""} fill sizes="42px" src={entry.mediaSrc ?? `/api/catalog/media/${encodeURIComponent(entry.mediaReference!)}`} /></span> : <span className={styles.searchSuggestionMediaPlaceholder} aria-hidden="true"><KtIconSearch size={17} /></span>}
                  <span className={styles.searchSuggestionCopy}><span>{entry.title}</span>{entry.detail ? <small>{entry.detail}</small> : null}</span>
                  <span aria-hidden="true" className={styles.searchSuggestionArrow}>↗</span>
                </button>;
              })}
            </div>;
          })}
        </div>
        {loading ? <p aria-live="polite" className={styles.searchSuggestionMessage} role="status">Finding matching products and places…</p> : null}
        {!loading && failed ? <p aria-live="polite" className={styles.searchSuggestionMessage} role="status">Suggestions are unavailable. Submit your search to see all results.</p> : null}
        {!loading && !failed && payload && !payload.products.length && !payload.categories.length && !payload.stores.length && !payload.brands.length ? <p aria-live="polite" className={styles.searchSuggestionMessage} role="status">No quick matches yet. Search to see all results.</p> : null}
      </div> : null}
    </div>
  );
}
