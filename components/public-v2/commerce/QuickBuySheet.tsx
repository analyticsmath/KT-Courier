"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StorefrontDocument, StorefrontProductCard } from "@/lib/storefront/storefront-types";
import type { StorefrontModifierGroupDTO } from "@/lib/services/storefront-catalog.service";
import { availabilityLabel } from "@/lib/storefront/storefront-availability-policy";
import { triggerCartFlight } from "./AddToCartFlightPortal";
import styles from "./commerce.module.css";

type ProductPayload = {
  product: StorefrontDocument;
  offers: StorefrontDocument[];
  modifierGroupsByOffer: Record<string, StorefrontModifierGroupDTO[]>;
};

function money(amount: string) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(amount));
}

function humanStoreName(offer: StorefrontDocument) {
  return offer.storeName ?? offer.storeSlug.split("-").filter(Boolean).map((part) => `${part[0]?.toLocaleUpperCase("en-ZA")}${part.slice(1)}`).join(" ");
}

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function QuickBuySheet({
  product,
  open,
  onClose,
}: {
  product: StorefrontProductCard;
  open: boolean;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<ProductPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<StorefrontDocument | null>(null);
  const [modifiers, setModifiers] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const media = selectedOffer?.primaryMedia ?? payload?.product.primaryMedia ?? product.primaryMedia;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const controls = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        if (!controls.length) return;
        const first = controls[0]!;
        const last = controls[controls.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setPayload(null);
      setSelectedOffer(null);
      setModifiers({});
      setQuantity(1);
      fetch(`/api/storefront/products/${encodeURIComponent(product.productReference)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("This item is not available to buy right now.");
          return response.json() as Promise<ProductPayload>;
        })
        .then((data) => {
          setPayload(data);
          if (data.offers.length === 1) setSelectedOffer(data.offers[0]!);
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          setError(reason instanceof Error ? reason.message : "Could not load this item.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, product.productReference]);

  const groups = selectedOffer ? payload?.modifierGroupsByOffer[selectedOffer.offerReference] ?? [] : [];
  const missingGroup = groups.find((group) => {
    const selected = modifiers[group.groupReference] ?? [];
    return selected.length < Math.max(group.minimumSelections, group.isRequired ? 1 : 0);
  });
  const purchasable = selectedOffer && (selectedOffer.availability === "IN_STOCK" || selectedOffer.availability === "LOW_STOCK");
  const offerCountLabel = useMemo(() => `${payload?.offers.length ?? 0} ${payload?.offers.length === 1 ? "option" : "options"}`, [payload?.offers.length]);

  const toggleOption = (group: StorefrontModifierGroupDTO, optionReference: string) => {
    setModifiers((current) => {
      const selected = current[group.groupReference] ?? [];
      if (selected.includes(optionReference)) return { ...current, [group.groupReference]: selected.filter((value) => value !== optionReference) };
      if (selected.length >= group.maximumSelections) return group.maximumSelections === 1 ? { ...current, [group.groupReference]: [optionReference] } : current;
      return { ...current, [group.groupReference]: [...selected, optionReference] };
    });
  };

  const addToCart = async () => {
    if (!selectedOffer || !purchasable || adding) return;
    if (missingGroup) {
      setError(`Choose an option for ${missingGroup.name}.`);
      panelRef.current?.querySelector(`[data-modifier-group="${CSS.escape(missingGroup.groupReference)}"]`)?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      const cartResponse = await fetch("/api/cart", { cache: "no-store" });
      if (!cartResponse.ok) throw new Error("Your cart could not be loaded. Please try again.");
      const cartData = await cartResponse.json();
      let version = cartData.cart?.version ?? 1;
      const modifierLines = Object.entries(modifiers).flatMap(([groupReference, optionReferences]) => optionReferences.map((optionReference) => ({ groupReference, optionReference, quantity: 1 })));
      const send = async (cartVersion: number) => {
        const operationId = `add-${crypto.randomUUID()}`;
        const requestHash = await hash(`${selectedOffer.offerReference}:${quantity}:${cartVersion}:${operationId}`);
        return fetch("/api/cart/lines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerReference: selectedOffer.offerReference, variantReference: selectedOffer.variantReference, quantity, modifiers: modifierLines, operationId, requestHash, cartVersion }),
        });
      };
      let response = await send(version);
      if (response.status === 409) {
        const refresh = await fetch("/api/cart", { cache: "no-store" });
        if (!refresh.ok) throw new Error("Your cart changed. Refresh and try again.");
        const latest = await refresh.json();
        version = latest.cart?.version ?? version + 1;
        response = await send(version);
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || detail.message || "This item could not be added to your cart.");
      }
      setSuccess("Added to your cart.");
      const source = panelRef.current?.querySelector<HTMLElement>('[data-kt-cart-flight-source="quick-buy"]');
      triggerCartFlight({ sourceElement: source, imageSrc: media ? `/api/catalog/media/${media.publicReference}` : undefined });
      window.dispatchEvent(new CustomEvent("kt-cart-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This item could not be added to your cart.");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.quickBuyBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-labelledby="quick-buy-title" aria-modal="true" className={styles.quickBuyPanel} ref={panelRef} role="dialog" tabIndex={-1}>
        <header className={styles.quickBuyHeader}>
          <div><p className={styles.productTileBrand}>Quick buy</p><h2 id="quick-buy-title">{product.title}</h2></div>
          <button aria-label="Close quick buy" className={styles.quickBuyClose} onClick={onClose} ref={closeRef} type="button">×</button>
        </header>
        <div className={styles.quickBuyBody}>
          <div className={styles.quickBuyProduct}>
            <div className={styles.quickBuyImage} data-kt-cart-flight-source="quick-buy">
              {media && <Image alt={media.alt || product.title} fill sizes="88px" src={`/api/catalog/media/${media.publicReference}`} style={{ objectFit: "cover" }} />}
            </div>
            <div><strong>{selectedOffer ? money(selectedOffer.price.amount) : `From ${money(product.price.amount)}`}</strong><div className={styles.productTileAvailability}>{loading ? "Loading options…" : `${offerCountLabel}${selectedOffer ? ` · ${availabilityLabel(selectedOffer.availability)}` : ""}`}</div></div>
          </div>

          {loading && <p role="status" className={styles.productActionFeedback}>Loading available options…</p>}
          {!loading && payload && payload.offers.length > 0 && <section className={styles.quickBuyGroup}>
            <h3>Choose an option</h3>
            <div className={styles.quickBuyChoices} role="radiogroup" aria-label="Seller and product option">
              {payload.offers.map((offer) => {
                const selected = selectedOffer?.offerReference === offer.offerReference;
                const variant = Object.values(offer.variantOptions).join(" · ");
                return <button aria-checked={selected} className={styles.quickBuyChoice} key={offer.offerReference} onClick={() => { setSelectedOffer(offer); setModifiers({}); setError(null); setSuccess(null); }} role="radio" type="button">
                  <span>{humanStoreName(offer)}{variant ? ` · ${variant}` : ""}</span><br /><small>{money(offer.price.amount)} · {availabilityLabel(offer.availability)}</small>
                </button>;
              })}
            </div>
          </section>}

          {groups.map((group) => <section className={styles.quickBuyGroup} data-modifier-group={group.groupReference} key={group.groupReference}>
            <h3>{group.name}{group.isRequired ? " · Required" : " · Optional"}</h3>
            {group.description && <p className={styles.productActionFeedback}>{group.description}</p>}
            <div aria-label={group.name} className={styles.quickBuyChoices}>
              {group.options.map((option) => {
                const active = (modifiers[group.groupReference] ?? []).includes(option.optionReference);
                return <button aria-pressed={active} className={styles.quickBuyChoice} key={option.optionReference} onClick={() => toggleOption(group, option.optionReference)} type="button">{option.name}{Number(option.priceDelta) !== 0 ? ` · ${money(option.priceDelta)}` : ""}</button>;
              })}
            </div>
          </section>)}

          {selectedOffer && <section className={styles.quickBuyGroup}><h3>Quantity</h3><div className={styles.quickBuyQuantity}><button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} type="button">−</button><output aria-label="Quantity">{quantity}</output><button aria-label="Increase quantity" disabled={quantity >= 99} onClick={() => setQuantity((value) => Math.min(99, value + 1))} type="button">+</button></div></section>}
          {error && <p className={styles.quickBuyError} role="alert">{error}</p>}
          {success && <p className={styles.productActionFeedback} role="status">{success}</p>}
        </div>
        <footer className={styles.quickBuyFooter}>
          <span>{selectedOffer ? money(selectedOffer.price.amount) : "Select an option"}</span>
          <button className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} disabled={!purchasable || adding || loading || !selectedOffer} onClick={addToCart} type="button">{adding ? "Adding…" : purchasable ? "Add to cart" : "Unavailable"}</button>
        </footer>
      </div>
    </div>
  );
}
