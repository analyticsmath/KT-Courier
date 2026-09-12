"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./commerce.module.css";

function formatMoney(amount: string | number | undefined | null) {
  if (amount === undefined || amount === null) return "R 0.00";
  const num = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    Number.isNaN(num) ? 0 : num
  );
}

async function computeHash(val: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface CheckoutStoreGroup {
  storeReference: string;
  status: string;
  fulfilmentMode: string;
  deliveryFee?: string;
  quoteReference?: string;
  lines: Array<{
    productReference: string;
    variantReference: string;
    offerReference: string;
    quantity: number;
    baseUnitPrice: string;
    modifierUnitTotal: string;
    lineTotal: string;
    modifiers: Array<{ groupReference: string; optionReference: string; quantity: number }>;
  }>;
}

interface PublicCheckoutData {
  reference: string;
  status: string;
  currency: "ZAR";
  version: number;
  totals: {
    merchandiseSubtotal: string;
    modifierSubtotal: string;
    deliveryFeeTotal: string;
    grandTotal: string;
  };
  storeGroups: CheckoutStoreGroup[];
  changes?: Array<{ type: string; lineReference: string; acknowledgedAt: string | null }>;
}

export function CheckoutExperience() {
  const searchParams = useSearchParams();
  const checkoutRef = searchParams.get("ref");

  const [checkout, setCheckout] = useState<PublicCheckoutData | null>(null);
  const [loading, setLoading] = useState(Boolean(checkoutRef));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMethod, setContactMethod] = useState("SMS");

  // Step 2: Address
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrSuburb, setAddrSuburb] = useState("");
  const [addrCity, setAddrCity] = useState("Johannesburg");
  const [addrProvince, setAddrProvince] = useState("Gauteng");
  const [addrPostalCode, setAddrPostalCode] = useState("2000");
  const [addrInstructions, setAddrInstructions] = useState("");

  // Step 4 & 5: Review & Acknowledgement
  const [reviewVersion, setReviewVersion] = useState<number | null>(null);
  const [commercialFingerprint, setCommercialFingerprint] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  // Step 6 & 7: Reservation & Payment
  const [orderComplete, setOrderComplete] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!checkoutRef) return;

    fetch(`/api/checkout/${checkoutRef}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Unable to load checkout session.");
        }
        return res.json();
      })
      .then((data) => {
        if (ignore) return;
        setCheckout(data.checkout);
        if (data.checkout.status === "RESERVED") {
          setCurrentStep(6);
        } else if (data.checkout.status === "COMPLETED") {
          setOrderComplete(true);
          setCurrentStep(7);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to load checkout.");
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [checkoutRef]);

  // Step 1 Submission: Contact
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const opId = `cnt-${crypto.randomUUID()}`;
      const hash = await computeHash(`${checkout.reference}:${contactEmail}:${contactPhone}:${opId}`);
      const res = await fetch(`/api/checkout/${checkout.reference}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: contactName.trim(),
          email: contactEmail.trim().toLowerCase(),
          phone: contactPhone.trim(),
          preferredContactMethod: contactMethod,
          operationId: opId,
          requestHash: hash,
          checkoutVersion: checkout.version,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to save contact information.");
      }

      const data = await res.json();
      setCheckout(data.checkout);
      setCurrentStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save contact.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 Submission: Address
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const opId = `adr-${crypto.randomUUID()}`;
      const hash = await computeHash(`${checkout.reference}:${addrLine1}:${addrCity}:${opId}`);
      const res = await fetch(`/api/checkout/${checkout.reference}/delivery-address`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: contactName.trim() || "Recipient",
          line1: addrLine1.trim(),
          line2: addrLine2.trim() || undefined,
          suburb: addrSuburb.trim() || undefined,
          city: addrCity.trim(),
          province: addrProvince.trim(),
          postalCode: addrPostalCode.trim() || undefined,
          deliveryInstructions: addrInstructions.trim() || undefined,
          serviceAreaReference: undefined,
          operationId: opId,
          requestHash: hash,
          checkoutVersion: checkout.version,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to save delivery address.");
      }

      const data = await res.json();
      setCheckout(data.checkout);

      // Auto-trigger delivery quotes
      await calculateQuotes(data.checkout.version);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save address.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Calculate Quotes
  const calculateQuotes = async (version: number) => {
    if (!checkout) return;
    setSubmitting(true);
    try {
      const opId = `qte-${crypto.randomUUID()}`;
      const hash = await computeHash(`quotes:${checkout.reference}:${version}:${opId}`);
      const res = await fetch(`/api/checkout/${checkout.reference}/delivery-quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: opId,
          requestHash: hash,
          checkoutVersion: version,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to calculate delivery quotes.");
      }

      const freshRes = await fetch(`/api/checkout/${checkout.reference}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(freshData.checkout);
      }
      setCurrentStep(3);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Quote calculation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3 Confirmation: Delivery Options -> Review
  const handleConfirmDeliveryAndReview = async () => {
    if (!checkout) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Confirm options
      const optOpId = `opt-${crypto.randomUUID()}`;
      const optHash = await computeHash(`options:${checkout.reference}:${optOpId}`);
      await fetch(`/api/checkout/${checkout.reference}/delivery-options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: optOpId,
          requestHash: optHash,
          checkoutVersion: checkout.version,
        }),
      });

      // 2. Perform authoritative Review
      const revOpId = `rev-${crypto.randomUUID()}`;
      const revHash = await computeHash(`review:${checkout.reference}:${checkout.version}:${revOpId}`);
      const revRes = await fetch(`/api/checkout/${checkout.reference}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: revOpId,
          requestHash: revHash,
          checkoutVersion: checkout.version,
        }),
      });

      if (!revRes.ok) {
        const err = await revRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Review calculation failed.");
      }

      const revData = await revRes.json();
      setReviewVersion(revData.reviewVersion ?? revData.version ?? 1);
      setCommercialFingerprint(revData.commercialFingerprint ?? "fingerprint-confirmed");

      // Refresh checkout
      const freshRes = await fetch(`/api/checkout/${checkout.reference}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(freshData.checkout);
      }
      setCurrentStep(4);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4 Confirmation: Acknowledge & Reserve Inventory
  const handleAcknowledgeAndReserve = async () => {
    if (!checkout || !termsAgreed || !commercialFingerprint || reviewVersion === null) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Acknowledge
      const ackOpId = `ack-${crypto.randomUUID()}`;
      const ackHash = await computeHash(`ack:${checkout.reference}:${reviewVersion}:${ackOpId}`);
      const ackRes = await fetch(`/api/checkout/${checkout.reference}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: ackOpId,
          requestHash: ackHash,
          checkoutVersion: checkout.version,
          reviewVersion,
          commercialFingerprint,
          acknowledgedTotalReference: checkout.totals.grandTotal,
          termsVersion: "terms-2026-v1",
          privacyVersion: "privacy-2026-v1",
          refundPolicyReferences: ["refund-policy-v1"],
        }),
      });

      if (!ackRes.ok) {
        const err = await ackRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Acknowledgement failed.");
      }

      // 2. Reserve
      const resOpId = `res-${crypto.randomUUID()}`;
      const resHash = await computeHash(`reserve:${checkout.reference}:${resOpId}`);
      const resRes = await fetch(`/api/checkout/${checkout.reference}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutVersion: checkout.version,
          operationId: resOpId,
          requestHash: resHash,
        }),
      });

      if (!resRes.ok) {
        const err = await resRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Inventory reservation failed.");
      }

      const freshRes = await fetch(`/api/checkout/${checkout.reference}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(freshData.checkout);
      }
      setCurrentStep(5);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to reserve order.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 5: Prepare Payment & Finalize
  const handlePreparePayment = async () => {
    if (!checkout) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payOpId = `pay-${crypto.randomUUID()}`;
      const payHash = await computeHash(`pay:${checkout.reference}:${payOpId}`);
      const res = await fetch(`/api/checkout/${checkout.reference}/prepare-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutVersion: checkout.version,
          operationId: payOpId,
          requestHash: payHash,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Payment initialization failed.");
      }

      const result = await res.json();
      if (result.providerAction?.type === "REDIRECT" && result.providerAction?.url) {
        window.location.href = result.providerAction.url;
        return;
      }

      setOrderComplete(true);
      setCurrentStep(6);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment preparation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checkoutRef) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 560, marginBottom: "1rem" }}>No Active Checkout Found</h1>
        <p style={{ color: "var(--kt-muted, #5f6763)", marginBottom: "2rem" }}>
          Please add items to your shopping cart and click &quot;Proceed to Checkout&quot;.
        </p>
        <Link
          href="/cart"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "var(--kt-carbon, #101210)",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          View Shopping Cart &rarr;
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", textAlign: "center" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--kt-muted, #5f6763)" }}>Loading checkout session...</p>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "#eef8f1", color: "#1e6e38", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem" }}>
          ✓
        </div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, marginBottom: "1rem" }}>Order Successfully Placed!</h1>
        <p style={{ fontSize: "1.1rem", color: "var(--kt-graphite, #303532)", marginBottom: "1.5rem" }}>
          Checkout Reference: <strong style={{ fontFamily: "var(--kt-font-mono, monospace)" }}>{checkout?.reference}</strong>
        </p>
        <p style={{ color: "var(--kt-muted, #5f6763)", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your order has been split into dedicated store fulfilment orders. Each vendor is preparing your package, and you will receive real-time SMS/Email courier tracking updates as delivery stages advance.
        </p>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "14px 28px",
            backgroundColor: "var(--kt-carbon, #101210)",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          Return to Marketplace &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.commerceInner} style={{ padding: "2.5rem 0 5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, margin: "0 0 0.5rem" }}>
          Authoritative Marketplace Checkout
        </h1>
        <p style={{ color: "var(--kt-muted, #5f6763)", margin: 0, fontSize: "0.95rem" }}>
          Reference: <span style={{ fontFamily: "var(--kt-font-mono, monospace)" }}>{checkout?.reference}</span> · Version {checkout?.version}
        </p>
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
        {/* Left Column: Multi-Step Flow */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Step 1: Contact Details */}
          <div
            style={{
              border: "1px solid var(--kt-cool-200, #dde1e0)",
              borderRadius: 6,
              padding: "24px",
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                1. Contact Information
              </h2>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{ background: "none", border: "none", color: "var(--kt-red, #d83a2e)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 1 ? (
              <form onSubmit={handleSaveContact} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label htmlFor="contactName" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                    Recipient Full Name
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Sipho Dlamini"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label htmlFor="contactEmail" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Email Address
                    </label>
                    <input
                      id="contactEmail"
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="sipho@example.co.za"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="contactPhone" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Phone Number (SA)
                    </label>
                    <input
                      id="contactPhone"
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="082 123 4567"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contactMethod" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                    Preferred Notification Channel
                  </label>
                  <select
                    id="contactMethod"
                    value={contactMethod}
                    onChange={(e) => setContactMethod(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4, backgroundColor: "#ffffff" }}
                  >
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 8,
                    padding: "10px 20px",
                    backgroundColor: "var(--kt-carbon, #101210)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Saving..." : "Continue to Delivery Address \u2192"}
                </button>
              </form>
            ) : (
              <div style={{ fontSize: "0.9rem", color: "var(--kt-muted, #5f6763)" }}>
                {contactName} · {contactEmail} · {contactPhone} ({contactMethod})
              </div>
            )}
          </div>

          {/* Step 2: Delivery Address */}
          <div
            style={{
              border: "1px solid var(--kt-cool-200, #dde1e0)",
              borderRadius: 6,
              padding: "24px",
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                2. Delivery Address & Instructions
              </h2>
              {currentStep > 2 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{ background: "none", border: "none", color: "var(--kt-red, #d83a2e)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 2 ? (
              <form onSubmit={handleSaveAddress} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label htmlFor="addrLine1" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                    Street Address (Line 1)
                  </label>
                  <input
                    id="addrLine1"
                    type="text"
                    required
                    value={addrLine1}
                    onChange={(e) => setAddrLine1(e.target.value)}
                    placeholder="124 Main Road"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label htmlFor="addrLine2" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Unit / Building (Optional)
                    </label>
                    <input
                      id="addrLine2"
                      type="text"
                      value={addrLine2}
                      onChange={(e) => setAddrLine2(e.target.value)}
                      placeholder="Unit 4B"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="addrSuburb" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Suburb / Area
                    </label>
                    <input
                      id="addrSuburb"
                      type="text"
                      value={addrSuburb}
                      onChange={(e) => setAddrSuburb(e.target.value)}
                      placeholder="Rosebank"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label htmlFor="addrCity" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      City
                    </label>
                    <input
                      id="addrCity"
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="addrProvince" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Province
                    </label>
                    <select
                      id="addrProvince"
                      value={addrProvince}
                      onChange={(e) => setAddrProvince(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    >
                      <option value="Gauteng">Gauteng</option>
                      <option value="Western Cape">Western Cape</option>
                      <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                      <option value="Eastern Cape">Eastern Cape</option>
                      <option value="Free State">Free State</option>
                      <option value="Limpopo">Limpopo</option>
                      <option value="Mpumalanga">Mpumalanga</option>
                      <option value="North West">North West</option>
                      <option value="Northern Cape">Northern Cape</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="addrPostalCode" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Postal Code
                    </label>
                    <input
                      id="addrPostalCode"
                      type="text"
                      value={addrPostalCode}
                      onChange={(e) => setAddrPostalCode(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="addrInstructions" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                    Delivery Instructions / Gate Access
                  </label>
                  <input
                    id="addrInstructions"
                    type="text"
                    value={addrInstructions}
                    onChange={(e) => setAddrInstructions(e.target.value)}
                    placeholder="Gate code #1234, please phone upon arrival"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-cool-200, #dde1e0)", borderRadius: 4 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 8,
                    padding: "10px 20px",
                    backgroundColor: "var(--kt-carbon, #101210)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Calculating Delivery Quotes..." : "Calculate Delivery \u2192"}
                </button>
              </form>
            ) : currentStep > 2 ? (
              <div style={{ fontSize: "0.9rem", color: "var(--kt-muted, #5f6763)" }}>
                {addrLine1}, {addrSuburb ? `${addrSuburb}, ` : ""}{addrCity}, {addrProvince} {addrPostalCode}
              </div>
            ) : null}
          </div>

          {/* Step 3: Delivery Quotes & Store Fulfilment */}
          {currentStep >= 3 && (
            <div
              style={{
                border: "1px solid var(--kt-cool-200, #dde1e0)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                3. Fulfilment & Delivery Breakdown
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {checkout?.storeGroups.map((group, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "var(--kt-cool-050, #f5f6f6)",
                      border: "1px solid var(--kt-cool-200, #dde1e0)",
                      borderRadius: 4,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>Store: {group.storeReference}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)", marginTop: 2 }}>
                        {group.fulfilmentMode === "STORE_PICKUP" ? "Store Pickup" : "Courier Direct Dispatch"} · {group.lines.length} items
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                        {group.deliveryFee ? formatMoney(group.deliveryFee) : "Calculated"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--kt-muted, #5f6763)" }}>Delivery Quote</div>
                    </div>
                  </div>
                ))}
              </div>

              {currentStep === 3 && (
                <button
                  type="button"
                  onClick={handleConfirmDeliveryAndReview}
                  disabled={submitting}
                  style={{
                    marginTop: "1.2rem",
                    padding: "12px 24px",
                    backgroundColor: "var(--kt-carbon, #101210)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Freezing Commercial Review..." : "Review Order & Final Totals \u2192"}
                </button>
              )}
            </div>
          )}

          {/* Step 4: Review & Terms Acknowledgement */}
          {currentStep >= 4 && (
            <div
              style={{
                border: "1px solid var(--kt-cool-200, #dde1e0)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                4. Final Commercial Review & Terms
              </h2>

              <div style={{ backgroundColor: "var(--kt-cool-050, #f5f6f6)", padding: "16px", borderRadius: 4, marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.9rem", color: "var(--kt-carbon, #101210)", lineHeight: 1.5 }}>
                  By completing this order, stock is locked authoritatively with the merchant(s), and delivery obligations are bound to KT Couriers (Pty) Ltd.
                </div>
                <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--kt-muted, #5f6763)" }}>
                  Commercial Evidence Fingerprint: <span style={{ fontFamily: "var(--kt-font-mono, monospace)" }}>{commercialFingerprint?.slice(0, 24)}...</span>
                </div>
              </div>

              {currentStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.9rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      I agree to the <Link href="/legal/terms" target="_blank" style={{ textDecoration: "underline" }}>Terms of Service</Link>, <Link href="/legal/privacy" target="_blank" style={{ textDecoration: "underline" }}>Privacy Policy</Link>, and the standard KT Couriers Returns & Refund Guarantee.
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAcknowledgeAndReserve}
                    disabled={!termsAgreed || submitting}
                    style={{
                      alignSelf: "flex-start",
                      padding: "12px 24px",
                      backgroundColor: termsAgreed ? "var(--kt-carbon, #101210)" : "#8e9591",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      fontWeight: 600,
                      cursor: termsAgreed && !submitting ? "pointer" : "not-allowed",
                    }}
                  >
                    {submitting ? "Reserving Inventory..." : "Acknowledge & Reserve Inventory \u2192"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep >= 5 && (
            <div
              style={{
                border: "1px solid var(--kt-cool-200, #dde1e0)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "#ffffff",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                5. Secure Payment
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    padding: "16px",
                    border: "2px solid var(--kt-carbon, #101210)",
                    borderRadius: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>Paystack Secure Digital Gateway</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)", marginTop: 2 }}>
                      Credit / Debit Card, Instant EFT, SnapScan (HMAC-SHA512 Verified)
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem" }}>🔒</span>
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)", lineHeight: 1.4 }}>
                  You will be securely redirected to Paystack to complete your card or instant EFT authorization for <strong>{formatMoney(checkout?.totals.grandTotal)}</strong>.
                </p>

                <button
                  type="button"
                  onClick={handlePreparePayment}
                  disabled={submitting}
                  style={{
                    marginTop: 8,
                    padding: "14px 24px",
                    backgroundColor: "var(--kt-carbon, #101210)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Initiating Paystack Gateway..." : `Pay ${formatMoney(checkout?.totals.grandTotal)} with Paystack \u2192`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Authoritative Multi-Vendor Summary */}
        <aside
          aria-label="Authoritative checkout summary"
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
            Summary Breakdown
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.95rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Merchandise Subtotal</span>
              <span style={{ fontWeight: 540 }}>{formatMoney(checkout?.totals.merchandiseSubtotal)}</span>
            </div>

            {Number(checkout?.totals.modifierSubtotal ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--kt-muted, #5f6763)" }}>Modifiers & Options</span>
                <span style={{ fontWeight: 540 }}>{formatMoney(checkout?.totals.modifierSubtotal)}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-muted, #5f6763)" }}>Delivery Fees Total</span>
              <span style={{ fontWeight: 540 }}>
                {Number(checkout?.totals.deliveryFeeTotal ?? 0) > 0 ? formatMoney(checkout?.totals.deliveryFeeTotal) : "Pending address"}
              </span>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--kt-cool-200, #dde1e0)",
                paddingTop: 12,
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--kt-carbon, #101210)",
              }}
            >
              <span>Authoritative Total</span>
              <span>{formatMoney(checkout?.totals.grandTotal)}</span>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--kt-cool-100, #eceeee)", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>
              Fulfilment Groups ({checkout?.storeGroups.length ?? 0}):
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", color: "var(--kt-graphite, #303532)", display: "flex", flexDirection: "column", gap: 6 }}>
              {checkout?.storeGroups.map((g, idx) => (
                <li key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{g.storeReference}</span>
                  <span style={{ color: "var(--kt-muted, #5f6763)" }}>{g.fulfilmentMode}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
