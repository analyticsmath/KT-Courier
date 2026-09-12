"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HydratedPublicCart, HydratedCartStoreGroup, HydratedCartLine } from "@/lib/marketplace-checkout/cart-projection";
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
      <div className={styles.commerceInner} style={{ padding: "4rem 0", textAlign: "center" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--kt-muted, #5f6763)" }}>Loading your shopping cart...</p>
      </div>
    );
  }

  const isEmpty = !cart || cart.storeGroups.length === 0 || cart.itemCount === 0;

  if (isEmpty) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, marginBottom: "1rem" }}>Your Cart is Empty</h1>
        <p style={{ fontSize: "1.05rem", color: "var(--kt-muted, #5f6763)", marginBottom: "2rem", lineHeight: 1.5 }}>
          Explore thousands of verified local stores, products, and courier delivery options across South Africa.
        </p>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "14px 28px",
            backgroundColor: "var(--kt-carbon, #101210)",
            color: "#ffffff",
            fontWeight: 600,
            textDecoration: "none",
            borderRadius: 4,
          }}
        >
          Explore Marketplace &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.commerceInner} style={{ padding: "2.5rem 0 5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, margin: 0 }}>
          Your Shopping Cart
        </h1>
        <span style={{ fontSize: "1rem", color: "var(--kt-muted, #5f6763)" }}>
          {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} across {cart.storeGroups.length} {cart.storeGroups.length === 1 ? "store" : "stores"}
        </span>
      </div>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(320px, 380px)",
          gap: "2.5rem",
          alignItems: "start",
        }}
      >
        {/* Multi-Vendor Store Groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {cart.storeGroups.map((group: HydratedCartStoreGroup) => (
            <section
              key={group.storeId}
              aria-label={`Items from ${group.storeName}`}
              style={{
                border: "1px solid var(--kt-cool-200, #dde1e0)",
                borderRadius: 6,
                backgroundColor: "#ffffff",
                overflow: "hidden",
              }}
            >
              {/* Store Header */}
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "var(--kt-cool-050, #f5f6f6)",
                  borderBottom: "1px solid var(--kt-cool-200, #dde1e0)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <Link
                    href={`/store/${group.storeSlug}`}
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
                  {group.fulfilmentMode === "STORE_PICKUP" ? "Store Pickup" : "Courier Delivery"}
                </span>
              </div>

              {/* Line Items */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {group.lines.map((line: HydratedCartLine) => {
                  const isMutating = mutatingLineRef === line.reference;
                  return (
                    <li
                      key={line.reference}
                      style={{
                        padding: "20px",
                        borderBottom: "1px solid var(--kt-cool-100, #eceeee)",
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 20,
                        alignItems: "center",
                        opacity: isMutating ? 0.6 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--kt-carbon, #101210)" }}>
                          {line.title}
                        </div>
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
                        <div style={{ fontSize: "0.9rem", color: "var(--kt-muted, #5f6763)", marginTop: 6 }}>
                          Unit Price: {formatMoney(line.effectiveUnitPrice)}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}>
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => handleUpdateQuantity(line, line.quantity - 1)}
                          disabled={line.quantity <= 1 || isMutating}
                          style={{
                            padding: "6px 10px",
                            background: "none",
                            border: "none",
                            cursor: line.quantity <= 1 || isMutating ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          -
                        </button>
                        <span style={{ padding: "6px 12px", fontSize: "0.9rem", fontWeight: 600, minWidth: 20, textAlign: "center" }}>
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => handleUpdateQuantity(line, line.quantity + 1)}
                          disabled={line.quantity >= 99 || isMutating}
                          style={{
                            padding: "6px 10px",
                            background: "none",
                            border: "none",
                            cursor: line.quantity >= 99 || isMutating ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total & Remove */}
                      <div style={{ textAlign: "right", minWidth: 100 }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                          {formatMoney(line.lineTotal)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line)}
                          disabled={isMutating}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--kt-red, #d83a2e)",
                            fontSize: "0.85rem",
                            cursor: isMutating ? "not-allowed" : "pointer",
                            padding: "4px 0",
                            marginTop: 4,
                            textDecoration: "underline",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Store Footer Subtotal */}
              <div
                style={{
                  padding: "14px 20px",
                  backgroundColor: "var(--kt-cool-050, #f5f6f6)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.95rem",
                }}
              >
                <span style={{ color: "var(--kt-muted, #5f6763)" }}>Store Subtotal</span>
                <span style={{ fontWeight: 600, color: "var(--kt-carbon, #101210)" }}>
                  {formatMoney(group.totals.subtotal)}
                </span>
              </div>
            </section>
          ))}
        </div>

        {/* Authoritative Order Summary Panel */}
        <aside
          aria-label="Cart summary"
          style={{
            border: "1px solid var(--kt-cool-200, #dde1e0)",
            borderRadius: 6,
            backgroundColor: "#ffffff",
            padding: "24px",
            position: "sticky",
            top: 24,
          }}
        >
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
            Delivery fees, promotions, and route verification are authoritatively evaluated per store in checkout.
          </p>

          <button
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
                textDecoration: "underline",
              }}
            >
              {clearingCart ? "Clearing..." : "Clear Shopping Cart"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
