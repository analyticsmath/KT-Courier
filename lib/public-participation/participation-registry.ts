export type ParticipationPathwayState =
  | "APPLICATION_AVAILABLE"
  | "CONTACT_TO_CONFIRM"
  | "PUBLISHED_OPENINGS_ONLY"
  | "INVITATION_ONLY"
  | "INFORMATIONAL_ONLY"
  | "UNAVAILABLE";

export type PublicAction = Readonly<{ label: string; href: string }>;

export type ParticipationDefinition = Readonly<{
  id: "STORE" | "DRIVER" | "PROMOTER";
  title: string;
  kicker: string;
  summary: string;
  state: ParticipationPathwayState;
  stateLabel: string;
  primaryAction: PublicAction;
  secondaryAction?: PublicAction;
  requirements: readonly string[];
  process: readonly Readonly<{ title: string; description: string }>[];
  mediaId: "participation-store" | "participation-driver" | "participation-promoter";
}>;

/**
 * Server-safe orientation copy drawn from existing public entry routes. It
 * deliberately excludes permissions, earnings, review evidence, fraud data,
 * documents, and private lifecycle records.
 */
export const participationRegistry = {
  STORE: {
    id: "STORE",
    title: "Stores",
    kicker: "Business account entry",
    summary: "Create the existing business account to coordinate delivery requests for a store. Marketplace browsing remains separately unavailable until its public storefront is approved.",
    state: "APPLICATION_AVAILABLE",
    stateLabel: "Business account registration available",
    primaryAction: { label: "Create a business account", href: "/signup?role=store" },
    secondaryAction: { label: "Marketplace availability", href: "/shop" },
    requirements: [
      "The public entry form asks for a business or store name and a contact person.",
      "The form asks for contact details and may include a business address.",
      "Account creation is separate from public storefront exposure.",
    ],
    process: [
      { title: "Create the business account", description: "Use the existing secure signup route and choose the business account option." },
      { title: "Use the account pathway", description: "The account supports delivery coordination; it does not imply a public marketplace listing." },
      { title: "Confirm the current next step", description: "Use support when the account route does not answer an operational question." },
    ],
    mediaId: "participation-store",
  },
  DRIVER: {
    id: "DRIVER",
    title: "Drivers",
    kicker: "Driver account and vehicle review",
    summary: "Create a driver account and submit identity, licence, and vehicle details for administrator review. Dispatch access also requires a configured service region.",
    state: "APPLICATION_AVAILABLE",
    stateLabel: "Driver account registration available",
    primaryAction: { label: "Create driver account", href: "/signup?role=driver" },
    secondaryAction: { label: "Driver network information", href: "/services/driver-network" },
    requirements: [
      "Verify the email address used to create the driver account.",
      "Submit identity, driving licence, profile photo, and required vehicle evidence for review.",
      "An account or document submission does not approve a driver or vehicle, or guarantee dispatch offers.",
    ],
    process: [
      { title: "Create and verify an account", description: "Choose the driver account option and verify your email address." },
      { title: "Submit onboarding evidence", description: "Add your identity, driving licence, profile photo, and vehicle documents for administrator review." },
      { title: "Wait for dispatch eligibility", description: "Dispatch offers require approved identity and vehicle evidence, an assigned service region, and an available driver profile." },
    ],
    mediaId: "participation-driver",
  },
  PROMOTER: {
    id: "PROMOTER",
    title: "Promoters",
    kicker: "Programme enquiries",
    summary: "Ask about the promoter programme through support. Qualification, agreement acceptance, referral attribution, and any earnings state remain governed by protected lifecycle services.",
    state: "CONTACT_TO_CONFIRM",
    stateLabel: "Programme availability confirmed by support",
    primaryAction: { label: "Ask about the promoter programme", href: "/contact" },
    secondaryAction: { label: "General support", href: "/contact" },
    requirements: [
      "A public application endpoint is not currently available.",
      "Programme availability and any next step are confirmed through the existing support route.",
      "Referral and earnings outcomes are governed by canonical qualification conditions, not public promises.",
    ],
    process: [
      { title: "Send an enquiry", description: "Use the existing contact form to ask whether the programme is currently available." },
      { title: "Receive current guidance", description: "Support can confirm the appropriate route without exposing protected programme records." },
      { title: "Use the governed lifecycle", description: "Any future application, review, agreement, and activation remain handled through the canonical service." },
    ],
    mediaId: "participation-promoter",
  },
} as const satisfies Record<ParticipationDefinition["id"], ParticipationDefinition>;

export const participationPathways = Object.values(participationRegistry);
