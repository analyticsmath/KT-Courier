import { describe, expect, it } from "vitest";
import { classifySellerRegistration } from "@/lib/admin/seller-identity-display";

describe("classifySellerRegistration", () => {
  it("distinguishes missing seller identity from supplied or missing registration references", () => {
    expect(classifySellerRegistration(null)).toEqual({
      classification: "MISSING_SELLER_IDENTITY",
      shortStatusLabel: "Missing seller identity information",
      explanation: "Missing approved legal entity verification. Required by South African law prior to public sale.",
    });

    expect(classifySellerRegistration({
      legalName: "Kalahari Roasters (Pty) Ltd",
      registrationReference: "2024/123456/07",
      vatRegistrationStatus: "NOT_REGISTERED",
    })).toEqual({
      classification: "SUPPLIED_REGISTRATION",
      shortStatusLabel: "Registration ref: 2024/123456/07",
      explanation: "Approved: Kalahari Roasters (Pty) Ltd (Registration ref: 2024/123456/07)",
    });

    expect(classifySellerRegistration({
      legalName: "Sipho Dlamini",
      registrationReference: null,
      vatRegistrationStatus: "NOT_REGISTERED",
    })).toEqual({
      classification: "INDIVIDUAL_UNREGISTERED",
      shortStatusLabel: "Individual / unregistered seller (no company registration)",
      explanation: "Approved: Sipho Dlamini (Individual / unregistered seller — no company registration)",
    });

    expect(classifySellerRegistration({
      legalName: "Cape Traders (Pty) Ltd",
      registrationReference: " ",
      vatRegistrationStatus: "NOT_REGISTERED",
    })).toEqual({
      classification: "MISSING_REGISTRATION_INFO",
      shortStatusLabel: "Missing company registration reference",
      explanation: "Approved: Cape Traders (Pty) Ltd (Missing company registration reference)",
    });

    expect(classifySellerRegistration({
      legalName: "Karoo Harvest",
      registrationReference: null,
      vatRegistrationStatus: "REGISTERED",
    })).toEqual({
      classification: "MISSING_REGISTRATION_INFO",
      shortStatusLabel: "Missing company registration reference",
      explanation: "Approved: Karoo Harvest (Missing company registration reference)",
    });
  });
});
