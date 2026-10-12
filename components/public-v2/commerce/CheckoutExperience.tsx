"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AddressAutocomplete, type AddressAutocompleteValue } from "@/components/maps/AddressAutocomplete";
import { useSearchParams } from "next/navigation";
import styles from "./commerce.module.css";
import { GuestCheckoutEmailUpdates } from "./GuestCheckoutEmailUpdates";

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
  storeName?: string;
  storeSlug?: string;
  status: string;
  fulfilmentMode: string;
  deliveryFee?: string;
  quoteReference?: string;
  lines: Array<{
    productReference: string;
    productTitle?: string;
    variantReference: string;
    variantTitle?: string;
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
  contact?: { recipientName: string; email: string; phone: string; preferredContactMethod: string | null };
  deliveryAddress?: { line1: string; line2: string | null; suburb: string | null; city: string; province: string; postalCode: string | null; deliveryInstructions: string | null };
  totals: {
    merchandiseSubtotal: string;
    modifierSubtotal: string;
    deliveryFeeTotal: string;
    grandTotal: string;
  };
  storeGroups: CheckoutStoreGroup[];
  changes?: Array<{ type: string; lineReference: string; acknowledgedAt: string | null }>;
}

function retainCheckoutPresentation(next: PublicCheckoutData, previous: PublicCheckoutData | null): PublicCheckoutData {
  if (!previous) return next;
  return {
    ...next,
    storeGroups: next.storeGroups.map((group) => {
      const oldGroup = previous.storeGroups.find((candidate) => candidate.storeReference === group.storeReference);
      return {
        ...group,
        storeName: group.storeName ?? oldGroup?.storeName,
        storeSlug: group.storeSlug ?? oldGroup?.storeSlug,
        lines: group.lines.map((line) => {
          const oldLine = oldGroup?.lines.find((candidate) => candidate.productReference === line.productReference && candidate.variantReference === line.variantReference);
          return { ...line, productTitle: line.productTitle ?? oldLine?.productTitle, variantTitle: line.variantTitle ?? oldLine?.variantTitle };
        }),
      };
    }),
  };
}

export function CheckoutExperience() {
  const searchParams = useSearchParams();
  const checkoutRef = searchParams.get("ref");
  return <CheckoutSession key={checkoutRef ?? "no-checkout"} checkoutRef={checkoutRef} />;
}

function CheckoutSession({ checkoutRef }: { checkoutRef: string | null }) {

  const [checkout, setCheckout] = useState<PublicCheckoutData | null>(null);
  const [loading, setLoading] = useState(Boolean(checkoutRef));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  // Step 1: Contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMethod, setContactMethod] = useState("EMAIL");
  const [contactRevision, setContactRevision] = useState(0);

  // Step 2: Address
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrSuburb, setAddrSuburb] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProvince, setAddrProvince] = useState("Gauteng");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [mappedAddress, setMappedAddress] = useState<AddressAutocompleteValue | null>(null);
  const [addrInstructions, setAddrInstructions] = useState("");

  // Step 4 & 5: Review & Acknowledgement
  const [reviewVersion, setReviewVersion] = useState<number | null>(null);
  const [commercialFingerprint, setCommercialFingerprint] = useState<string | null>(null);
  const [legalEvidence, setLegalEvidence] = useState<{ termsVersion: string; privacyVersion: string; refundPolicyReferences: string[] } | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  function invalidateReview() {
    setReviewVersion(null); setCommercialFingerprint(null); setLegalEvidence(null); setTermsAgreed(false);
  }

  // Step 6 & 7: Reservation & Payment
  const [orderComplete, setOrderComplete] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!checkoutRef) return;

    fetch(`/api/checkout/${encodeURIComponent(checkoutRef)}`)
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
        const saved = data.checkout as PublicCheckoutData;
        setContactName(saved.contact?.recipientName ?? "");
        setContactEmail(saved.contact?.email ?? "");
        setContactPhone(saved.contact?.phone ?? "");
        setContactMethod(saved.contact?.preferredContactMethod ?? "EMAIL");
        setAddrLine1(saved.deliveryAddress?.line1 ?? "");
        setAddrLine2(saved.deliveryAddress?.line2 ?? "");
        setAddrSuburb(saved.deliveryAddress?.suburb ?? "");
        setAddrCity(saved.deliveryAddress?.city ?? "");
        setAddrProvince(saved.deliveryAddress?.province ?? "Gauteng");
        setAddrPostalCode(saved.deliveryAddress?.postalCode ?? "");
        setAddrInstructions(saved.deliveryAddress?.deliveryInstructions ?? "");
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

    const activeRef = checkoutRef || checkout.reference;

    try {
      const opId = `cnt-${crypto.randomUUID()}`;
      const hash = await computeHash(`${activeRef}:${contactEmail}:${contactPhone}:${opId}`);
      const res = await fetch(`/api/checkout/${activeRef}/contact`, {
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
      if (data.checkout && data.checkout.storeGroups) {
        setCheckout(retainCheckoutPresentation(data.checkout, checkout));
      } else {
        const freshRes = await fetch(`/api/checkout/${activeRef}`);
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setCheckout(retainCheckoutPresentation(freshData.checkout, checkout));
        }
      }
      setContactRevision((revision) => revision + 1);
      invalidateReview();
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

    const activeRef = checkoutRef || checkout.reference;

    try {
      const opId = `adr-${crypto.randomUUID()}`;
      const hash = await computeHash(`${activeRef}:${addrLine1}:${addrCity}:${opId}`);
      const res = await fetch(`/api/checkout/${activeRef}/delivery-address`, {
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
      let nextVersion: number | null = null;
      if (data.checkout && data.checkout.storeGroups) {
        setCheckout(retainCheckoutPresentation(data.checkout, checkout));
        nextVersion = data.checkout.version;
      } else {
        const freshRes = await fetch(`/api/checkout/${activeRef}`);
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setCheckout(retainCheckoutPresentation(freshData.checkout, checkout));
          nextVersion = freshData.checkout.version;
        }
      }

      invalidateReview();
      if (!Number.isSafeInteger(nextVersion) || nextVersion === null || nextVersion < 1) throw new Error("The saved checkout version could not be verified. Refresh before continuing.");
      // Auto-trigger delivery quotes
      await calculateQuotes(nextVersion);
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
    const activeRef = checkoutRef || checkout.reference;
    try {
      const opId = `qte-${crypto.randomUUID()}`;
      const hash = await computeHash(`quotes:${activeRef}:${version}:${opId}`);
      const res = await fetch(`/api/checkout/${activeRef}/delivery-quotes`, {
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

      // Consume the authoritative response before refreshing the checkout.
      // Leaving a fetch body unread can stall browser network receipts.
      const quoteResult = await res.json();
      if (!Array.isArray(quoteResult.quotes) || quoteResult.quotes.length !== checkout.storeGroups.length) throw new Error("Delivery quote evidence could not be verified. Refresh before continuing.");

      const freshRes = await fetch(`/api/checkout/${activeRef}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(retainCheckoutPresentation(freshData.checkout, checkout));
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

    const activeRef = checkoutRef || checkout.reference;

    try {
      // 1. Confirm options & persist selection
      const optOpId = `opt-${crypto.randomUUID()}`;
      const optHash = await computeHash(`options:${activeRef}:${optOpId}`);
      const optRes = await fetch(`/api/checkout/${activeRef}/delivery-options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: optOpId,
          requestHash: optHash,
          checkoutVersion: checkout.version,
        }),
      });

      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to confirm delivery options.");
      }

      const optData = await optRes.json();
      if (!Number.isSafeInteger(optData.checkout?.version) || optData.checkout.version < 1) throw new Error("The saved delivery selection could not be verified. Refresh before continuing.");
      const currentVersionBeforeReview = optData.checkout.version;
      invalidateReview();

      // 2. Perform authoritative Review
      const revOpId = `rev-${crypto.randomUUID()}`;
      const revHash = await computeHash(`review:${activeRef}:${currentVersionBeforeReview}:${revOpId}`);
      const revRes = await fetch(`/api/checkout/${activeRef}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: revOpId,
          requestHash: revHash,
          checkoutVersion: currentVersionBeforeReview,
        }),
      });

      if (!revRes.ok) {
        const err = await revRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Review calculation failed.");
      }

      const revData = await revRes.json();
      if (!Number.isSafeInteger(revData.reviewVersion) || revData.reviewVersion < 1 || typeof revData.commercialFingerprint !== "string" || !revData.commercialFingerprint || typeof revData.legalEvidence?.termsVersion !== "string" || typeof revData.legalEvidence?.privacyVersion !== "string" || !Array.isArray(revData.legalEvidence?.refundPolicyReferences) || !revData.legalEvidence.refundPolicyReferences.length || revData.legalEvidence.refundPolicyReferences.some((reference: unknown) => typeof reference !== "string" || !reference)) throw new Error("Current order review and published policy evidence are required before continuing.");
      setReviewVersion(revData.reviewVersion);
      setCommercialFingerprint(revData.commercialFingerprint);
      setLegalEvidence(revData.legalEvidence);
      setTermsAgreed(false);

      // Refresh checkout
      const freshRes = await fetch(`/api/checkout/${activeRef}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(retainCheckoutPresentation(freshData.checkout, checkout));
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
    if (!checkout || !termsAgreed || !commercialFingerprint || reviewVersion === null || !legalEvidence) return;
    setSubmitting(true);
    setErrorMessage(null);

    const activeRef = checkoutRef || checkout.reference;

    try {
      // 1. Acknowledge
      const ackOpId = `ack-${crypto.randomUUID()}`;
      const ackHash = await computeHash(`ack:${activeRef}:${reviewVersion}:${ackOpId}`);
      const ackRes = await fetch(`/api/checkout/${activeRef}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: ackOpId,
          requestHash: ackHash,
          checkoutVersion: checkout.version,
          reviewVersion,
          commercialFingerprint,
          acknowledgedTotalReference: checkout.totals.grandTotal,
          ...legalEvidence,
        }),
      });

      if (!ackRes.ok) {
        const err = await ackRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Acknowledgement failed.");
      }

      const ackData = await ackRes.json();
      if (!Number.isSafeInteger(ackData.checkoutVersion) || ackData.checkoutVersion < 1) throw new Error("The acknowledged checkout version could not be verified. Refresh before continuing.");
      const currentVersionAfterAck = ackData.checkoutVersion;

      // 2. Reserve with currentVersionAfterAck
      const resOpId = `res-${crypto.randomUUID()}`;
      const resHash = await computeHash(`reserve:${activeRef}:${resOpId}`);
      const resRes = await fetch(`/api/checkout/${activeRef}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutVersion: currentVersionAfterAck,
          operationId: resOpId,
          requestHash: resHash,
        }),
      });

      if (!resRes.ok) {
        const err = await resRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Inventory reservation failed.");
      }

      const freshRes = await fetch(`/api/checkout/${activeRef}`);
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        setCheckout(retainCheckoutPresentation(freshData.checkout, checkout));
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

    const activeRef = checkoutRef || checkout.reference;

    try {
      const payOpId = `pay-${crypto.randomUUID()}`;
      const payHash = await computeHash(`pay:${activeRef}:${payOpId}`);
      const res = await fetch(`/api/checkout/${activeRef}/prepare-payment`, {
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
      if (
        result.providerAction?.type === "REDIRECT_GET" &&
        typeof result.providerAction?.endpoint === "string"
      ) {
        window.location.assign(result.providerAction.endpoint);
        return;
      }

      // Backward-compatible guard for any older response shape still in flight.
      if (
        result.providerAction?.type === "REDIRECT" &&
        typeof result.providerAction?.url === "string"
      ) {
        window.location.assign(result.providerAction.url);
        return;
      }

      setErrorMessage(
        "Payment authorization is pending but no safe Paystack redirect was returned. Refresh the checkout before retrying."
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment preparation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!checkoutRef) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 560, marginBottom: "1rem" }}>Your checkout is not available</h1>
        <p style={{ color: "var(--kt-public-text-muted)", marginBottom: "2rem" }}>
          Please add items to your shopping cart and click &quot;Proceed to Checkout&quot;.
        </p>
        <Link
          href="/cart"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "var(--kt-public-surface-inverse)",
            color: "var(--kt-public-text-inverse)",
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
        <p style={{ fontSize: "1.1rem", color: "var(--kt-public-text-muted)" }}>Preparing your checkout…</p>
      </div>
    );
  }

  if (!checkout) {
    return <div className={styles.commerceInner} style={{ padding: "4rem 0", textAlign: "center" }}>
      <h1>Your checkout is not available</h1>
      <p role="alert">{errorMessage ?? "The checkout could not be loaded. Please try again."}</p>
      <Link href="/cart">Return to cart</Link>
    </div>;
  }

  if (orderComplete) {
    return (
      <div className={styles.commerceInner} style={{ padding: "4rem 0", maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "var(--kt-public-surface-secondary)", color: "var(--kt-state-success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem" }}>
          ✓
        </div>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, marginBottom: "1rem" }}>Your order is confirmed</h1>
        <p style={{ fontSize: "1.1rem", color: "var(--kt-public-text-muted)", marginBottom: "1.5rem" }}>
          Order reference: <strong style={{ fontFamily: "var(--kt-font-mono, monospace)" }}>{checkout?.reference}</strong>
        </p>
        <p style={{ color: "var(--kt-public-text-muted)", lineHeight: 1.6, marginBottom: "2rem" }}>
          Your order is being prepared by the stores shown in your order summary. You can follow its progress as fulfilment updates become available.
        </p>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "14px 28px",
            backgroundColor: "var(--kt-public-surface-inverse)",
            color: "var(--kt-public-text-inverse)",
            textDecoration: "none",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.commerceInner} style={{ padding: "2.5rem 0 5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 560, margin: "0 0 0.5rem" }}>
          Secure checkout
        </h1>
        <p style={{ color: "var(--kt-public-text-muted)", margin: 0, fontSize: "0.95rem" }}>
          Order reference: <span style={{ fontFamily: "var(--kt-font-mono, monospace)" }}>{checkout?.reference}</span>
        </p>
      </div>

      {errorMessage && (
        <div
          id="checkout-error"
          role="alert"
          style={{
            padding: "14px 18px",
            backgroundColor: "var(--kt-public-surface-secondary)",
            border: "1px solid var(--kt-public-border-control)",
            color: "var(--kt-state-error)",
            borderRadius: 4,
            marginBottom: "1.5rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      <p role="status" aria-live="polite" aria-atomic="true">
        Step {Math.min(currentStep, 5)} of 5: {["Contact", "Delivery address", "Delivery options", "Review your order", "Payment"][Math.min(currentStep, 5) - 1]}
      </p>

      <div className={styles.checkoutMainLayout}>
        {/* Left Column: Multi-Step Flow */}
        <div className={styles.checkoutMainColumn}>
          {/* Step 1: Contact Details */}
          <div
            style={{
              border: "1px solid var(--kt-public-border-control)",
              borderRadius: 6,
              padding: "24px",
              backgroundColor: "var(--kt-public-surface-primary)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 id="checkout-contact-heading" ref={currentStep === 1 ? stepHeadingRef : undefined} tabIndex={-1} style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                1. Contact
              </h2>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  style={{ background: "none", border: "none", color: "var(--kt-public-interactive-text)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 1 ? (
              <form aria-labelledby="checkout-contact-heading" aria-describedby={errorMessage ? "checkout-error" : undefined} onSubmit={handleSaveContact} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                  />
                </div>

                <div className={styles.checkoutFieldGrid}>
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
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
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
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
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
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4, backgroundColor: "var(--kt-public-surface-primary)" }}
                  >
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
                    backgroundColor: "var(--kt-public-surface-inverse)",
                    color: "var(--kt-public-text-inverse)",
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
              <div style={{ fontSize: "0.9rem", color: "var(--kt-public-text-muted)" }}>
                {contactName} · {contactEmail} · {contactPhone} ({contactMethod})
                {checkout && <GuestCheckoutEmailUpdates key={contactRevision} checkoutReference={checkoutRef || checkout.reference} />}
              </div>
            )}
          </div>

          {/* Step 2: Delivery Address */}
          <div
            style={{
              border: "1px solid var(--kt-public-border-control)",
              borderRadius: 6,
              padding: "24px",
              backgroundColor: "var(--kt-public-surface-primary)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 id="checkout-address-heading" ref={currentStep === 2 ? stepHeadingRef : undefined} tabIndex={-1} style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                2. Delivery address
              </h2>
              {currentStep > 2 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  style={{ background: "none", border: "none", color: "var(--kt-public-interactive-text)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}
                >
                  Edit
                </button>
              )}
            </div>

            {currentStep === 2 ? (
              <form aria-labelledby="checkout-address-heading" aria-describedby={errorMessage ? "checkout-error" : undefined} onSubmit={handleSaveAddress} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY && <AddressAutocomplete
                  label="Find your delivery address on the map"
                  value={mappedAddress}
                  onChange={(address) => {
                    setMappedAddress(address);
                    if (!address) return;
                    setAddrLine1(address.line1);
                    setAddrCity(address.city ?? "");
                    setAddrProvince(address.province ?? "");
                    setAddrPostalCode(address.postalCode ?? "");
                    setAddrSuburb("");
                  }}
                  showContactFields={false}
                  showNotesField={false}
                />}
                <div>
                  <label htmlFor="addrLine1" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                    Street Address (Line 1)
                  </label>
                  <input
                    id="addrLine1"
                    type="text"
                    required
                    value={addrLine1}
                    onChange={(e) => { setAddrLine1(e.target.value); setMappedAddress(null); }}
                    placeholder="124 Main Road"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                  />
                </div>

                <div className={styles.checkoutFieldGrid}>
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
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
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
                      onChange={(e) => { setAddrSuburb(e.target.value); setMappedAddress(null); }}
                      placeholder="Rosebank"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                    />
                  </div>
                </div>

                <div className={styles.checkoutFieldGridThree}>
                  <div>
                    <label htmlFor="addrCity" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      City
                    </label>
                    <input
                      id="addrCity"
                      type="text"
                      required
                      value={addrCity}
                      onChange={(e) => { setAddrCity(e.target.value); setMappedAddress(null); }}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="addrProvince" style={{ display: "block", fontSize: "0.875rem", fontWeight: 540, marginBottom: 4 }}>
                      Province
                    </label>
                    <select
                      id="addrProvince"
                      value={addrProvince}
                      onChange={(e) => { setAddrProvince(e.target.value); setMappedAddress(null); }}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                    >
                      <option value="">Select province</option>
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
                      onChange={(e) => { setAddrPostalCode(e.target.value); setMappedAddress(null); }}
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
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
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--kt-public-border-control)", borderRadius: 4 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 8,
                    padding: "10px 20px",
                    backgroundColor: "var(--kt-public-surface-inverse)",
                    color: "var(--kt-public-text-inverse)",
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
              <div style={{ fontSize: "0.9rem", color: "var(--kt-public-text-muted)" }}>
                {addrLine1}, {addrSuburb ? `${addrSuburb}, ` : ""}{addrCity}, {addrProvince} {addrPostalCode}
              </div>
            ) : null}
          </div>

          {/* Step 3: Delivery Quotes & Store Fulfilment */}
          {currentStep >= 3 && (
            <div
              style={{
                border: "1px solid var(--kt-public-border-control)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "var(--kt-public-surface-primary)",
              }}
            >
              <h2 ref={currentStep === 3 ? stepHeadingRef : undefined} tabIndex={-1} style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                3. Delivery options
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {checkout?.storeGroups.map((group, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "var(--kt-public-surface-secondary)",
                      border: "1px solid var(--kt-public-border-control)",
                      borderRadius: 4,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{group.storeName ?? "Local store"}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--kt-public-text-muted)", marginTop: 2 }}>
                        {group.fulfilmentMode === "STORE_PICKUP" ? "Store pickup" : group.fulfilmentMode === "PICKUP_AND_DELIVERY" ? "Pickup and delivery" : "Courier delivery"} · {group.lines.length} {group.lines.length === 1 ? "item" : "items"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                        {group.deliveryFee ? formatMoney(group.deliveryFee) : "Calculated"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--kt-public-text-muted)" }}>Delivery fee</div>
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
                    backgroundColor: "var(--kt-public-surface-inverse)",
                    color: "var(--kt-public-text-inverse)",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Updating order…" : "Review order →"}
                </button>
              )}
            </div>
          )}

          {/* Step 4: Review & Terms Acknowledgement */}
          {currentStep >= 4 && (
            <div
              style={{
                border: "1px solid var(--kt-public-border-control)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "var(--kt-public-surface-primary)",
              }}
            >
              <h2 ref={currentStep === 4 ? stepHeadingRef : undefined} tabIndex={-1} style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                4. Review your order
              </h2>

              <div style={{ backgroundColor: "var(--kt-public-surface-secondary)", padding: "16px", borderRadius: 4, marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.9rem", color: "var(--kt-public-text-primary)", lineHeight: 1.5 }}>
                  Review your items and delivery details, then accept the terms to continue to payment.
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
                      I accept the <Link href="/terms" target="_blank" style={{ textDecoration: "underline" }}>Terms of Service</Link> and <Link href="/refund-policy" target="_blank" style={{ textDecoration: "underline" }}>Refund and Cancellation Policy</Link>, and acknowledge the <Link href="/privacy-policy" target="_blank" style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAcknowledgeAndReserve}
                    disabled={!termsAgreed || submitting}
                    style={{
                      alignSelf: "flex-start",
                      padding: "12px 24px",
                      backgroundColor: termsAgreed ? "var(--kt-public-text-primary)" : "var(--kt-public-text-inverse-muted)",
                      color: "var(--kt-public-text-inverse)",
                      border: "none",
                      borderRadius: 4,
                      fontWeight: 600,
                      cursor: termsAgreed && !submitting ? "pointer" : "not-allowed",
                    }}
                  >
                    {submitting ? "Preparing payment…" : "Continue to payment →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep >= 5 && (
            <div
              style={{
                border: "1px solid var(--kt-public-border-control)",
                borderRadius: 6,
                padding: "24px",
                backgroundColor: "var(--kt-public-surface-primary)",
              }}
            >
              <h2 ref={currentStep === 5 ? stepHeadingRef : undefined} tabIndex={-1} style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 1rem" }}>
                5. Payment
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    padding: "16px",
                    border: "2px solid var(--kt-public-text-primary)",
                    borderRadius: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>Paystack</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--kt-public-text-muted)", marginTop: 2 }}>
                      Available payment methods are shown securely by Paystack.
                    </div>
                  </div>
                  <svg aria-hidden="true" width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 14v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--kt-public-text-muted)", lineHeight: 1.4 }}>
                  You will be securely redirected to Paystack to complete your card or instant EFT authorization for <strong>{formatMoney(checkout?.totals.grandTotal)}</strong>.
                </p>

                <button
                  type="button"
                  onClick={handlePreparePayment}
                  disabled={submitting}
                  style={{
                    marginTop: 8,
                    padding: "14px 24px",
                    backgroundColor: "var(--kt-public-surface-inverse)",
                    color: "var(--kt-public-text-inverse)",
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

        {/* Order summary */}
        <aside aria-label="Order summary" className={styles.checkoutSummary}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 560, marginTop: 0, marginBottom: "1.2rem" }}>
            Order summary
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.95rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-public-text-muted)" }}>Merchandise Subtotal</span>
              <span style={{ fontWeight: 540 }}>{formatMoney(checkout?.totals.merchandiseSubtotal)}</span>
            </div>

            {Number(checkout?.totals.modifierSubtotal ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--kt-public-text-muted)" }}>Modifiers & Options</span>
                <span style={{ fontWeight: 540 }}>{formatMoney(checkout?.totals.modifierSubtotal)}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--kt-public-text-muted)" }}>Delivery Fees Total</span>
              <span style={{ fontWeight: 540 }}>
                {Number(checkout?.totals.deliveryFeeTotal ?? 0) > 0 ? formatMoney(checkout?.totals.deliveryFeeTotal) : "Pending address"}
              </span>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--kt-public-border-subtle)",
                paddingTop: 12,
                marginTop: 6,
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "var(--kt-public-text-primary)",
              }}
            >
              <span>Total</span>
              <span>{formatMoney(checkout?.totals.grandTotal)}</span>
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--kt-public-surface-tertiary)", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>
              Stores in this order ({checkout?.storeGroups.length ?? 0})
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", color: "var(--kt-public-text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              {checkout?.storeGroups.map((g, idx) => (
                <li key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{g.storeName ?? "Local store"}</span>
                  <span style={{ color: "var(--kt-public-text-muted)" }}>{g.fulfilmentMode === "STORE_PICKUP" ? "Store pickup" : g.fulfilmentMode === "PICKUP_AND_DELIVERY" ? "Pickup and delivery" : "Courier delivery"}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
