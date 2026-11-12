import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const quotePage = readFileSync("app/(public)/quote/page.tsx", "utf8");
const bookingPage = readFileSync("app/(public)/quote/book/page.tsx", "utf8");
const quoteForm = readFileSync("components/forms/PublicDeliveryQuoteForm.tsx", "utf8");

describe("quote, sign-in and booking are distinct accessible steps", () => {
  it("redirects old signed-in quote links to a dedicated form without exposing a quote in URLs", () => {
    expect(quotePage).toContain("redirect(parcelBookingStepHref(p.reference,");
    expect(bookingPage).toContain("getCurrentUser()");
    expect(bookingPage).toContain("business={business}");
    expect(bookingPage).toContain('workspace === "store"');
    expect(bookingPage).toContain('getStorePickupAddress(user.id, "deliveries")');
    expect(bookingPage).toContain("bookingOnly");
    expect(bookingPage).toContain("reference={reference}");
    expect(bookingPage).toContain('aria-current="step"');
    expect(bookingPage).toContain("Complete your delivery");
  });

  it("sends both login and signup back to contact entry, not the long quotation page", () => {
    expect(quoteForm).toContain("encodeURIComponent(parcelBookingStepHref(quote.id, business))");
    expect(quoteForm).toContain("/signup?role=customer&returnUrl=");
    expect(quoteForm).toContain("!bookingOnly && <form onSubmit={estimate}");
    expect(quoteForm).toContain("bookingOnly && signedIn");
    expect(quoteForm).toContain("Continue to delivery details");
  });
});
