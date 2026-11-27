export type SellerIdentityDisplayInput = Readonly<{
  legalName: string;
  tradingName?: string | null;
  registrationReference?: string | null;
  vatRegistrationStatus?: string | null;
}>;

export type SellerRegistrationClassification =
  | "SUPPLIED_REGISTRATION"
  | "INDIVIDUAL_UNREGISTERED"
  | "MISSING_REGISTRATION_INFO"
  | "MISSING_SELLER_IDENTITY";

const CORPORATE_LEGAL_ENTITY_SUFFIX = /\b(?:pty|ltd|inc|llc|npc|trust|cc)\b/i;

export function classifySellerRegistration(
  identity: SellerIdentityDisplayInput | null | undefined,
): {
  classification: SellerRegistrationClassification;
  shortStatusLabel: string;
  explanation: string;
} {
  if (!identity) {
    return {
      classification: "MISSING_SELLER_IDENTITY",
      shortStatusLabel: "Missing seller identity information",
      explanation: "Missing approved legal entity verification. Required by South African law prior to public sale.",
    };
  }

  const regRef = identity.registrationReference?.trim() ?? "";
  if (regRef.length > 0) {
    return {
      classification: "SUPPLIED_REGISTRATION",
      shortStatusLabel: `Registration ref: ${regRef}`,
      explanation: `Approved: ${identity.legalName} (Registration ref: ${regRef})`,
    };
  }

  const looksLikeCorporateEntity = CORPORATE_LEGAL_ENTITY_SUFFIX.test(identity.legalName);
  const vatRegistered = identity.vatRegistrationStatus === "REGISTERED";
  if (!looksLikeCorporateEntity && !vatRegistered) {
    return {
      classification: "INDIVIDUAL_UNREGISTERED",
      shortStatusLabel: "Individual / unregistered seller (no company registration)",
      explanation: `Approved: ${identity.legalName} (Individual / unregistered seller — no company registration)`,
    };
  }

  return {
    classification: "MISSING_REGISTRATION_INFO",
    shortStatusLabel: "Missing company registration reference",
    explanation: `Approved: ${identity.legalName} (Missing company registration reference)`,
  };
}
