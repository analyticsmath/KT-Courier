"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import type { HydratedPublicCart, HydratedCartStoreGroup, HydratedCartLine } from "@/lib/marketplace-checkout/cart-projection";
import { marketplaceStoreHref } from "@/lib/public-marketplace/routes";
import { marketplaceProductHref } from "@/lib/public-marketplace/routes";
import styles from "./commerce.module.css";

function formatMoney(amount: string | number) {
  const num = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    Number.isNaN(num) ? 0 : num
  );
}

async function computeHash(val: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function CartExperience() {
  const router = useRouter();
  const [cart, setCart] = useState<HydratedPublicCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingLineRef, setMutatingLineRef] = useState<string | null>(null);
  const [clearingCart, setClearingCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCart = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch("/api/cart");
      if (!res.ok) throw new Error("Failed to load cart.");
      const data = await res.json();
      setCart(data.cart);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not load cart.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/cart")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load cart.");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setCart(data.cart);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMessage(err instanceof Error ? err.message : "Could not load cart.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUpdateQuantity = async (line: HydratedCartLine, newQuantity: number) => {
    if (!cart || newQuantity < 1 || newQuantity > 99 || mutatingLineRef) return;
    setMutatingLineRef(line.reference);
    setErrorMessage(null);

    try {
      const opId = `qty-${crypto.randomUUID()}`;
      const reqHash = await computeHash(`${cart.reference}:${line.reference}:${newQuantity}:${cart.version}:${opId}`);
      const res = await fetch(`/api/cart/lines/${line.reference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartReference: cart.reference,
          cartVersion: cart.version,
          operationId: opId,
          requestHash: reqHash,
          quantity: newQuantity,
        }),
      });

      if (res.status === 409) {
        await fetchCart();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to update quantity.");
      }

      const data = await res.json();
      if (data.cart?.totals) {
        setCart(data.cart);
      } else {
        await fetchCart();
      }
      window.dispatchEvent(new CustomEvent("kt-cart-updated"));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update item quantity.");
    } finally {
      setMutatingLineRef(null);
    }
  };

  const handleRemoveLine = async (line: HydratedCartLine) => {
    if (!cart || mutatingLineRef) return;
    setMutatingLineRef(line.reference);
    setErrorMessage(null);

    try {
      const opId = `rem-${crypto.randomUUID()}`;
      const reqHash = await computeHash(`${cart.reference}:${line.reference}:${cart.version}:${opId}`);
      const res = await fetch(`/api/cart/lines/${line.reference}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartReference: cart.reference,
          cartVersion: cart.version,
          operationId: opId,
          requestHash: reqHash,
        }),
      });

      if (res.status === 409) {
        await fetchCart();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to remove item.");
      }

      const data = await res.json();
      if (data.cart?.totals) {
        setCart(data.cart);
      } else {
        await fetchCart();
      }
      window.dispatchEvent(new CustomEvent("kt-cart-updated"));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not remove item.");
    } finally {
      setMutatingLineRef(null);
    }
  };

  const handleClearCart = async () => {
    if (!cart || clearingCart) return;
    setClearingCart(true);
    setErrorMessage(null);

    try {
      const opId = `clr-${crypto.randomUUID()}`;
      const reqHash = await computeHash(`${cart.reference}:${cart.version}:${opId}`);
      const res = await fetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartReference: cart.reference,
          cartVersion: cart.version,
          operationId: opId,
          requestHash: reqHash,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to clear cart.");
      }

      const data = await res.json();
      if (data.cart?.totals) {
        setCart(data.cart);
      } else {
        await fetchCart();
      }
      window.dispatchEvent(new CustomEvent("kt-cart-updated"));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not clear cart.");
    } finally {
      setClearingCart(false);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!cart || checkingOut) return;
    setCheckingOut(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartReference: cart.reference,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to create checkout session.");
      }

      const data = await res.json();
      const checkoutRef = data.checkout?.reference;
      if (!checkoutRef) throw new Error("Server did not return a valid checkout session.");

      router.push(`/checkout?ref=${checkoutRef}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Checkout initialization failed.");
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div aria-busy="true" className={`${styles.commerceInner} ${styles.cartPage}`}>
        <div className={styles.commercePageIntro}><div className={styles.cartSkeletonHeading} /><p>Loading your shopping bag…</p></div>
        <div className={styles.cartSkeletonLine} />
        <div className={styles.cartSkeletonLine} />
      </div>
    );
  }

  const isEmpty = !cart || cart.storeGroups.length === 0 || cart.itemCount === 0;

  if (isEmpty) {
    return (
      <div className={`${styles.commerceInner} ${styles.cartEmptyState}`}>
        <svg aria-hidden="true" className={styles.cartEmptyIcon} fill="none" viewBox="0 0 64 64"><path d="M12 20h40l-4 34H16l-4-34Z" stroke="currentColor" strokeWidth="2"/><path d="M23 24v-6a9 9 0 0 1 18 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        <h1 className={styles.commerceTitle}>Your cart is empty</h1>
        <p className={styles.commerceLead}>Find something you love, then it will be waiting here.</p>
        <Link className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} href="/shop">Browse products</Link>
        <div className={styles.cartCategoryLinks}><Link href="/shop/categories">Shop by category</Link><Link href="/shop/stores">Explore stores</Link></div>
      </div>
    );
  }

  return (
    <div className={`${styles.commerceInner} ${styles.cartPage}`}>
      <header className={styles.cartPageHeader}>
        <h1 className={styles.commerceTitle}>Shopping bag</h1>
        <span style={{ fontSize: "1rem", color: "var(--kt-muted, #5f6763)" }}>
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} across {cart.storeGroups.length} {cart.storeGroups.length === 1 ? "store" : "stores"}
        </span>
      </header>

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "14px 18px",
            backgroundColor: "#fdf2f2",
            border: "1px solid #f8b4b4",
            color: "#ba1a1a",
            borderRadius: 4,
            marginBottom: "1.5rem",
            fontSize: "0.95rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div className={styles.cartLayout}>
        {/* Multi-Vendor Store Groups */}
        <div className={styles.cartStoreGroups}>
          {cart.storeGroups.map((group: HydratedCartStoreGroup) => (
            <section
              key={group.storeId}
              aria-label={`Items from ${group.storeName}`}
              className={styles.cartStoreGroup}
            >
              {/* Store Header */}
              <div className={styles.cartStoreHeader}>
                <div>
                  <Link
                    href={marketplaceStoreHref(group.storeSlug) ?? "/shop"}
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 600,
                      color: "var(--kt-carbon, #101210)",
                      textDecoration: "none",
                    }}
                  >
                    {group.storeName}
                  </Link>
                </div>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "4px 10px",
                    backgroundColor: "var(--kt-cool-200, #dde1e0)",
                    color: "var(--kt-carbon, #101210)",
                    borderRadius: 4,
                  }}
                >
                  {group.fulfilmentMode === "STORE_PICKUP" ? "Store pickup" : group.fulfilmentMode === "PICKUP_AND_DELIVERY" ? "Pickup and delivery" : "Courier delivery"}
                </span>
              </div>

              {/* Line Items */}
              <ul className={styles.cartLineList}>
                <AnimatePresence initial={false}>
                  {group.lines.map((line: HydratedCartLine) => {
                    const isMutating = mutatingLineRef === line.reference;
                    return (
                      <motion.li
                        animate={{ opacity: isMutating ? 0.6 : 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                        initial={{ opacity: 0, height: 0 }}
                        key={line.reference}
                        layout
                        className={styles.cartLine}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                      >
                        {line.primaryMediaReference ? <span className={styles.cartLineMedia}><Image alt={line.primaryMediaAlt || line.title} fill sizes="(max-width: 767px) 96px, 128px" src={`/api/catalog/media/${line.primaryMediaReference}`} style={{ objectFit: "cover" }} /></span> : <span aria-hidden="true" className={styles.cartLineMedia} />}
                        <div className={styles.cartLineInfo}>
                          {line.productSlug && marketplaceProductHref(line.productSlug, line.productReference) ? <Link className={styles.cartProductTitle} href={marketplaceProductHref(line.productSlug, line.productReference)!}>{line.title}</Link> : <strong className={styles.cartProductTitle}>{line.title}</strong>}
                          {line.variantTitle && (
                            <div style={{ fontSize: "0.875rem", color: "var(--kt-muted, #5f6763)", marginTop: 2 }}>
                              Variant: {line.variantTitle}
                            </div>
                          )}
                          {line.modifiers.length > 0 && (
                            <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", fontSize: "0.85rem", color: "var(--kt-graphite, #303532)" }}>
                              {line.modifiers.map((mod, idx) => (
                                <li key={idx}>
                                  + {mod.optionName} ({formatMoney(mod.priceDelta)})
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className={styles.cartLineUnitPrice}>
                            {formatMoney(line.effectiveUnitPrice)} each
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className={styles.cartQuantityStepper}>
                          <button
                            aria-label="Decrease quantity"
                            disabled={line.quantity <= 1 || isMutating}
                            onClick={() => handleUpdateQuantity(line, line.quantity - 1)}
                            className={styles.cartQuantityButton}
                            type="button"
                          >
                            -
                          </button>
                          <span className={styles.cartQuantityValue}>
                            {line.quantity}
                          </span>
                          <button
                            aria-label="Increase quantity"
                            disabled={line.quantity >= 99 || isMutating}
                            onClick={() => handleUpdateQuantity(line, line.quantity + 1)}
                            className={styles.cartQuantityButton}
                            type="button"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total & Remove */}
                        <div className={styles.cartLineTotal}>
            <div className={styles.cartLineAmount}>
                            {formatMoney(line.lineTotal)}
                          </div>
                          <button
                            disabled={isMutating}
                            onClick={() => handleRemoveLine(line)}
                            className={styles.cartRemoveButton}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              {/* Store Footer Subtotal */}
              <div className={styles.cartStoreFooter}>
                <span style={{ color: "var(--kt-muted, #5f6763)" }}>Store Subtotal</span>
                <span style={{ fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                  {formatMoney(group.totals.subtotal)}
                </span>
              </div>
            </section>
          ))}
        </div>

        {/* Authoritative Order Summary Panel */}
        <aside aria-label="Cart summary" className={styles.cartSummary}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 560, marginTop: 0, marginBottom: "1.2rem" }}>
            Order Summary
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.95rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Merchandise Subtotal</span>
              <span style={{ fontWeight: 540 }}>{formatMoney(cart.totals.merchandiseSubtotal)}</span>
            </div>

            {Number(cart.totals.modifierSubtotal) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--kt-muted, #5f6763)" }}>Modifiers & Options</span>
                <span style={{ fontWeight: 540 }}>{formatMoney(cart.totals.modifierSubtotal)}</span>
              </div>
            )}

            <div
              style={{
                borderTop: "1px solid var(--kt-cool-200, #dde1e0)",
                paddingTop: 12,
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.2rem",
                fontWeight: 600,
                color: "var(--kt-carbon, #101210)",
              }}
            >
              <span>Estimated Subtotal</span>
              <span>{formatMoney(cart.totals.grandTotal)}</span>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--kt-muted, #5f6763)",
              lineHeight: 1.4,
              marginTop: "1.2rem",
              backgroundColor: "var(--kt-cool-050, #f5f6f6)",
              padding: "10px 12px",
              borderRadius: 4,
            }}
          >
            Delivery fees and available promotions are confirmed during checkout.
          </p>

          <button
            className={`${styles.productActionButton} ${styles.productActionButtonPrimary} ${styles.cartSummaryPrimary}`}
            type="button"
            onClick={handleProceedToCheckout}
            disabled={checkingOut}
            style={{
              marginTop: "1.5rem",
              width: "100%",
              padding: "14px 20px",
              backgroundColor: "var(--kt-carbon, #101210)",
              color: "#ffffff",
              border: "none",
              borderRadius: 4,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: checkingOut ? "not-allowed" : "pointer",
            }}
          >
            {checkingOut ? "Preparing Checkout..." : "Proceed to Checkout \u2192"}
          </button>

          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={handleClearCart}
              disabled={clearingCart}
              style={{
                background: "none",
                border: "none",
                color: "var(--kt-muted, #5f6763)",
                fontSize: "0.85rem",
                cursor: clearingCart ? "not-allowed" : "pointer",
                padding: "6px 12px",
                borderRadius: "999px",
                transition: "color 140ms ease",
              }}
            >
              {clearingCart ? "Clearing..." : "Clear Shopping Cart"}
            </button>
          </div>
        </aside>
      </div>
      <div className={styles.cartMobileCheckout}>
        <span><small>Order total</small><strong>{formatMoney(cart.totals.grandTotal)}</strong></span>
        <button className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} disabled={checkingOut} onClick={handleProceedToCheckout} type="button">{checkingOut ? "Preparing…" : "Checkout"}</button>
      </div>
    </div>
  );
}
