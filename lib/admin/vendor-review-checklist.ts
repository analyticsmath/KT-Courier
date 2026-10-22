export type VendorReviewFacts = Readonly<{
  hasOwner: boolean;
  ownerActive: boolean;
  ownerEmailVerified: boolean;
  hasBusinessContact: boolean;
  hasPickupAddress: boolean;
  hasApprovedSellerIdentity: boolean;
  publishedOfferCount: number;
  storefrontActive: boolean;
}>;

export type VendorReviewCheck = Readonly<{
  key: "owner" | "contact" | "pickup" | "seller" | "catalog";
  title: string;
  ready: boolean;
  explanation: string;
}>;

/**
 * Read-only review indicators, not an authorisation policy. Account approval,
 * seller identity, product publication and finance use separate server gates.
 */
export function vendorReviewChecklist(facts: VendorReviewFacts): VendorReviewCheck[] {
  return [
    { key: "owner", title: "Account owner", ready: facts.hasOwner && facts.ownerActive && facts.ownerEmailVerified, explanation: facts.ownerEmailVerified && facts.ownerActive && facts.hasOwner ? "Owner account active and email verified." : "Verify the owner account and email before relying on contact details." },
    { key: "contact", title: "Business contact", ready: facts.hasBusinessContact, explanation: facts.hasBusinessContact ? "A business contact is recorded." : "Business contact information needs review." },
    { key: "pickup", title: "Collection address", ready: facts.hasPickupAddress, explanation: facts.hasPickupAddress ? "A default collection address is recorded; serviceability is checked separately." : "No default parcel collection address is recorded." },
    { key: "seller", title: "Legal seller identity", ready: facts.hasApprovedSellerIdentity, explanation: facts.hasApprovedSellerIdentity ? "An independently approved seller identity is active." : "Independent legal seller approval is not yet established." },
    { key: "catalog", title: "Published marketplace catalog", ready: facts.storefrontActive && facts.publishedOfferCount > 0, explanation: facts.storefrontActive && facts.publishedOfferCount > 0 ? `${facts.publishedOfferCount} public offer(s) in the active storefront.` : "No active published storefront offers; account approval does not publish products." },
  ];
}
