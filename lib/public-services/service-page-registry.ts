import type { Metadata } from "next";
import type { ServiceMediaId } from "@/lib/public-assets/service-media";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export type PublicServiceFamily =
  | "EVERYDAY_MOVEMENT"
  | "BUSINESS_FLOW"
  | "PLANNED_MOVEMENT"
  | "QUOTE_INTELLIGENCE";

export type PublicServiceId =
  | "parcel"
  | "ecommerce"
  | "food"
  | "grocery"
  | "pharmacy"
  | "moving"
  | "freight"
  | "shuttle"
  | "business"
  | "driver-network"
  | "pricing";

export type ServiceAction = {
  label: string;
  href: string;
};

export type PublicServicePageDefinition = {
  id: PublicServiceId;
  route: `/services/${string}`;
  slug: string;
  family: PublicServiceFamily;
  title: string;
  eyebrow: string;
  summary: string;
  metadataTitle: string;
  metadataDescription: string;
  heroMediaId: ServiceMediaId;
  detailMediaIds: readonly ServiceMediaId[];
  idealFor: readonly string[];
  process: readonly { title: string; description: string }[];
  preparation: readonly string[];
  pricingFactors: readonly string[];
  restrictions: readonly string[];
  coverageMode: "ACTIVE_REGIONS" | "CONTACT_CONFIRMATION";
  relatedServiceIds: readonly PublicServiceId[];
  faqIds: readonly ServiceFaqId[];
  primaryAction: ServiceAction;
  secondaryAction?: ServiceAction;
  indexable: boolean;
  primaryActionIsQuote: boolean;
};

export type ServiceFaqId = "request" | "scheduled" | "coverage" | "orders" | "business" | "driver" | "pricing";

export const serviceFaqs: Record<ServiceFaqId, { question: string; answer: string }> = {
  request: {
    question: "How do I request a delivery?",
    answer: "Create a customer account, then enter pickup and dropoff details, a delivery type, parcel information, and any notes in the Request a Delivery form.",
  },
  scheduled: {
    question: "Can I plan a delivery for later?",
    answer: "The delivery request form includes a Scheduled delivery type and a preferred date field for planned requests.",
  },
  coverage: {
    question: "How is coverage confirmed?",
    answer: "KT Couriers operates in local service areas. Pickup and dropoff suitability is confirmed when the request is reviewed and can vary by delivery type.",
  },
  orders: {
    question: "Where do I view delivery updates?",
    answer: "Customers and stores can view order-status updates in their account dashboard. This is not anonymous live-driver tracking.",
  },
  business: {
    question: "Can a business manage repeat deliveries?",
    answer: "Stores and local businesses can create an account to manage repeat delivery requests, active orders, and delivery history.",
  },
  driver: {
    question: "How do I ask about the driver network?",
    answer: "Contact the team to ask about current participation information. This page does not provide a public enrolment or earnings flow.",
  },
  pricing: {
    question: "How is a quote prepared?",
    answer: "A quote is prepared through the authenticated request flow using the delivery information provided for that request.",
  },
};

const quoteAction: ServiceAction = { label: "Get a quote", href: "/account/request-delivery" };
const accountOrdersAction: ServiceAction = { label: "View order updates", href: "/account/orders" };
const contactAction: ServiceAction = { label: "Contact support", href: "/contact" };

const requestPreparation = [
  "Pickup address and contact details.",
  "Dropoff address and recipient contact details.",
  "Delivery type, parcel count, and a clear description.",
  "A scheduled date and practical notes when they are relevant.",
] as const;

const requestPricingFactors = [
  "Pickup and dropoff information entered for the request.",
  "The selected delivery type.",
  "Parcel count, description, and relevant request notes.",
  "Scheduling and service availability confirmed during review.",
] as const;

const quoteConfirmation = [
  "Specific handling, size, and availability requirements are confirmed during the quote process.",
] as const;

export const publicServicePages = [
  {
    id: "parcel",
    route: "/services/parcel",
    slug: "parcel",
    family: "EVERYDAY_MOVEMENT",
    title: "Small parcels. Clear progress.",
    eyebrow: "Parcel and document delivery",
    summary: "A direct route into the authenticated delivery-request flow for documents, parcels, and practical local handoffs.",
    metadataTitle: "Parcel and document delivery",
    metadataDescription: "Request local parcel and document delivery with KT Couriers. Coverage and delivery details are confirmed through the account-based request flow.",
    heroMediaId: "parcel-detail",
    detailMediaIds: ["parcel-handoff", "delivery-handoff"],
    idealFor: ["Documents and envelopes that need a clear pickup and dropoff.", "Small parcel requests with recipient details ready.", "Planned or local delivery requests handled through one account."],
    process: [
      { title: "Describe the request", description: "Choose a delivery type and add the parcel count and description." },
      { title: "Add both addresses", description: "Enter pickup, recipient, and practical access information." },
      { title: "Review and submit", description: "The team reviews the request and confirms the next step." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: quoteConfirmation,
    coverageMode: "ACTIVE_REGIONS",
    relatedServiceIds: ["business", "pricing", "ecommerce"],
    faqIds: ["request", "scheduled", "coverage", "orders"],
    primaryAction: quoteAction,
    secondaryAction: accountOrdersAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "ecommerce",
    route: "/services/ecommerce",
    slug: "ecommerce",
    family: "BUSINESS_FLOW",
    title: "Orders moving beyond checkout.",
    eyebrow: "E-commerce delivery and fulfilment",
    summary: "An account-based delivery pathway for stores and businesses coordinating customer-order handoffs.",
    metadataTitle: "E-commerce delivery and fulfilment",
    metadataDescription: "Explore account-based e-commerce delivery and fulfilment pathways for local stores using KT Couriers.",
    heroMediaId: "business-dispatch",
    detailMediaIds: ["operations-preparation", "store-preparation"],
    idealFor: ["Stores coordinating customer-order dropoffs.", "Businesses preparing repeat delivery requests.", "Teams that need account-based order-status visibility."],
    process: [
      { title: "Prepare the order details", description: "Record the delivery information required for the customer handoff." },
      { title: "Submit through the account", description: "Use the delivery-request flow for pickup and destination details." },
      { title: "Follow account updates", description: "Use the account dashboard for delivery-status updates." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: quoteConfirmation,
    coverageMode: "ACTIVE_REGIONS",
    relatedServiceIds: ["business", "parcel", "pricing"],
    faqIds: ["business", "request", "coverage", "orders"],
    primaryAction: quoteAction,
    secondaryAction: accountOrdersAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "food",
    route: "/services/food",
    slug: "food",
    family: "EVERYDAY_MOVEMENT",
    title: "Local orders in motion.",
    eyebrow: "Food delivery",
    summary: "A local delivery request can include clear order and handling notes for a food-related handoff.",
    metadataTitle: "Food delivery",
    metadataDescription: "Request local food delivery through KT Couriers. Availability and handling requirements are confirmed during the quote process.",
    heroMediaId: "food-grocery-preparation",
    detailMediaIds: ["delivery-handoff", "parcel-handoff"],
    idealFor: ["Food-related local delivery requests with complete pickup details.", "Orders where practical handoff notes need to be shared.", "Customers who need availability confirmed for a specific request."],
    process: [
      { title: "Set out the handoff", description: "Provide the pickup, dropoff, and recipient details for the request." },
      { title: "Add handling notes", description: "Use the request notes for information the team should review." },
      { title: "Confirm availability", description: "Availability and requirements are confirmed during the quote process." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Food-related handling and availability requirements are confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["grocery", "pharmacy", "pricing"],
    faqIds: ["request", "coverage", "orders"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "grocery",
    route: "/services/grocery",
    slug: "grocery",
    family: "EVERYDAY_MOVEMENT",
    title: "From store to doorstep.",
    eyebrow: "Grocery delivery",
    summary: "A delivery-request pathway for grocery-related local handoffs, with availability confirmed for the individual request.",
    metadataTitle: "Grocery delivery",
    metadataDescription: "Request local grocery delivery through KT Couriers. Service availability is confirmed during the account-based quote process.",
    heroMediaId: "food-grocery-preparation",
    detailMediaIds: ["delivery-handoff", "parcel-detail"],
    idealFor: ["Local grocery-related delivery requests with full addresses.", "Recipients who can be identified at the delivery address.", "Requests that need clear notes for the review team."],
    process: [
      { title: "Prepare the request", description: "Add the pickup, recipient, and delivery address information." },
      { title: "Clarify the details", description: "Use parcel descriptions and notes to explain the handoff." },
      { title: "Receive confirmation", description: "The team confirms availability during the quote review." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Grocery-related handling and service availability are confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["food", "pharmacy", "pricing"],
    faqIds: ["request", "coverage", "orders"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "pharmacy",
    route: "/services/pharmacy",
    slug: "pharmacy",
    family: "EVERYDAY_MOVEMENT",
    title: "Deliveries that need clear handling notes.",
    eyebrow: "Pharmacy delivery",
    summary: "A cautious request pathway for pharmacy-related delivery needs, subject to quote-time handling and availability confirmation.",
    metadataTitle: "Pharmacy delivery",
    metadataDescription: "Ask KT Couriers about pharmacy-related local delivery needs. Requirements and availability are confirmed through the quote process.",
    heroMediaId: "delivery-handoff",
    detailMediaIds: ["parcel-handoff", "delivery-status-context"],
    idealFor: ["Pharmacy-related delivery enquiries needing clear pickup and recipient details.", "Requests where the team should review handling notes before confirmation.", "Local handoffs subject to service availability."],
    process: [
      { title: "Explain the request", description: "Use the parcel description and notes to give the team clear context." },
      { title: "Share both handoffs", description: "Provide pickup, delivery, and recipient information." },
      { title: "Confirm before booking", description: "Requirements are confirmed during the quote process before the request proceeds." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Pharmacy-related handling, suitability, and availability must be confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["grocery", "food", "pricing"],
    faqIds: ["request", "coverage", "orders"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "moving",
    route: "/services/moving",
    slug: "moving",
    family: "PLANNED_MOVEMENT",
    title: "More than a parcel.",
    eyebrow: "Moving",
    summary: "A planning-led request pathway for moving needs where the practical details are assessed before confirmation.",
    metadataTitle: "Moving services",
    metadataDescription: "Request a moving quote from KT Couriers. Practical requirements, availability, and delivery details are confirmed during review.",
    heroMediaId: "freight-movement",
    detailMediaIds: ["operations-preparation", "local-road-context"],
    idealFor: ["Moving requests that need a clear pickup and destination plan.", "Jobs where access notes should be shared before confirmation.", "Scheduled local movement subject to quote review."],
    process: [
      { title: "Plan the movement", description: "Add the delivery type, both addresses, and practical notes." },
      { title: "Describe what moves", description: "Use the parcel count and description fields to give useful context." },
      { title: "Confirm the arrangement", description: "The team confirms practical requirements during quote review." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Large, unusual, access, and availability requirements are confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["freight", "shuttle", "pricing"],
    faqIds: ["request", "scheduled", "coverage"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "freight",
    route: "/services/freight",
    slug: "freight",
    family: "PLANNED_MOVEMENT",
    title: "Larger loads, coordinated clearly.",
    eyebrow: "Freight",
    summary: "A quote-led conversation for freight needs, with operational suitability assessed from the details supplied.",
    metadataTitle: "Freight services",
    metadataDescription: "Ask KT Couriers about freight requirements through a quote request. Practical suitability and availability are confirmed during review.",
    heroMediaId: "freight-movement",
    detailMediaIds: ["local-road-context", "operations-preparation"],
    idealFor: ["Freight enquiries that need clear collection and delivery details.", "Planned movement where practical notes should be reviewed.", "Requests requiring availability confirmation before booking."],
    process: [
      { title: "Set out the locations", description: "Add accurate pickup and destination information to the request." },
      { title: "Describe the load", description: "Use the parcel description and notes to explain the requirements." },
      { title: "Confirm suitability", description: "The team reviews practical availability before confirming the request." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Freight suitability, loading, handling, and availability requirements are confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["moving", "shuttle", "pricing"],
    faqIds: ["request", "coverage", "pricing"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "shuttle",
    route: "/services/shuttle",
    slug: "shuttle",
    family: "PLANNED_MOVEMENT",
    title: "Planned transport, clearly arranged.",
    eyebrow: "Shuttle",
    summary: "A planning enquiry for shuttle-related movement where the team confirms current suitability and availability before booking.",
    metadataTitle: "Shuttle planning",
    metadataDescription: "Ask KT Couriers about shuttle-related planned movement. Current suitability and availability are confirmed during the quote process.",
    heroMediaId: "local-road-context",
    detailMediaIds: ["operations-preparation", "local-road-context"],
    idealFor: ["Planned transport enquiries with clear route and timing context.", "Requests that need practical details reviewed before confirmation.", "Local movement subject to current service availability."],
    process: [
      { title: "Share the plan", description: "Provide pickup, destination, timing, and practical notes." },
      { title: "Review the request", description: "The team considers the details supplied for the proposed movement." },
      { title: "Confirm availability", description: "Current suitability and booking options are confirmed before proceeding." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["Shuttle-related suitability, scheduling, and availability are confirmed during the quote process."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["moving", "freight", "pricing"],
    faqIds: ["scheduled", "coverage", "pricing"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "business",
    route: "/services/business",
    slug: "business",
    family: "BUSINESS_FLOW",
    title: "Delivery that fits repeat operations.",
    eyebrow: "Business courier solutions",
    summary: "For stores and local businesses that need an account-based way to request and manage repeat deliveries.",
    metadataTitle: "Business courier solutions",
    metadataDescription: "Explore account-based business courier delivery for stores and local businesses using KT Couriers.",
    heroMediaId: "store-preparation",
    detailMediaIds: ["business-dispatch", "operations-preparation"],
    idealFor: ["Stores coordinating repeat customer handoffs.", "Local businesses managing active delivery requests.", "Teams that need account order history and status visibility."],
    process: [
      { title: "Create the account", description: "Set up the business pathway for delivery requests and order visibility." },
      { title: "Submit delivery details", description: "Use the request flow for each pickup, recipient, and destination." },
      { title: "Manage account updates", description: "Review active orders and delivery history from the account area." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: quoteConfirmation,
    coverageMode: "ACTIVE_REGIONS",
    relatedServiceIds: ["ecommerce", "parcel", "driver-network"],
    faqIds: ["business", "request", "orders", "coverage"],
    primaryAction: quoteAction,
    secondaryAction: accountOrdersAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
  {
    id: "driver-network",
    route: "/services/driver-network",
    slug: "driver-network",
    family: "BUSINESS_FLOW",
    title: "The people behind every handoff.",
    eyebrow: "Driver network",
    summary: "A public introduction to the driver-network role behind delivery operations, with current participation information confirmed by the team.",
    metadataTitle: "Driver network",
    metadataDescription: "Learn about the KT Couriers driver network and contact the team for current participation information.",
    heroMediaId: "driver-context",
    detailMediaIds: ["store-preparation", "delivery-handoff"],
    idealFor: ["People seeking current information about the courier-driver network.", "Businesses wanting to understand the people behind delivery handoffs.", "Visitors who need a team-confirmed participation pathway."],
    process: [
      { title: "Ask about participation", description: "Contact the team for current network information." },
      { title: "Receive current guidance", description: "The team confirms what participation information is presently available." },
      { title: "Keep delivery requests separate", description: "Customer delivery requests continue through the standard account-based quote flow." },
    ],
    preparation: ["A clear enquiry about the information you need.", "Contact details for a reply from the team."],
    pricingFactors: ["Driver-network participation is not presented as a public customer price or booking product."],
    restrictions: ["This page does not provide an open public enrolment, assignment, or earnings flow."],
    coverageMode: "CONTACT_CONFIRMATION",
    relatedServiceIds: ["business", "ecommerce", "parcel"],
    faqIds: ["driver", "business", "orders"],
    primaryAction: contactAction,
    secondaryAction: { label: "Explore delivery services", href: "/services" },
    indexable: true,
    primaryActionIsQuote: false,
  },
  {
    id: "pricing",
    route: "/services/pricing",
    slug: "pricing",
    family: "QUOTE_INTELLIGENCE",
    title: "Understand what shapes a quote.",
    eyebrow: "Pricing explanation",
    summary: "An explanation of the request information used by the authenticated quote workflow, without a public calculator or advertised rates.",
    metadataTitle: "Delivery pricing explained",
    metadataDescription: "Understand the delivery information used to prepare a KT Couriers quote. Submit an authenticated delivery request for current pricing.",
    heroMediaId: "delivery-status-context",
    detailMediaIds: ["parcel-detail", "parcel-handoff"],
    idealFor: ["Customers preparing delivery information before requesting a quote.", "Businesses clarifying the details needed for repeat delivery requests.", "Visitors who need the canonical route to current pricing."],
    process: [
      { title: "Add the locations", description: "Enter pickup and dropoff information in the delivery request." },
      { title: "Describe the delivery", description: "Choose a delivery type and record parcel details and notes." },
      { title: "Receive a current quote", description: "The authenticated request workflow prepares pricing from the request details." },
    ],
    preparation: requestPreparation,
    pricingFactors: requestPricingFactors,
    restrictions: ["This page does not advertise fixed prices or replace the authenticated quote workflow."],
    coverageMode: "ACTIVE_REGIONS",
    relatedServiceIds: ["parcel", "business", "freight"],
    faqIds: ["pricing", "request", "coverage"],
    primaryAction: quoteAction,
    secondaryAction: contactAction,
    indexable: true,
    primaryActionIsQuote: true,
  },
] as const satisfies readonly PublicServicePageDefinition[];

export const publicServiceFamilies: readonly { id: PublicServiceFamily; label: string; description: string }[] = [
  { id: "EVERYDAY_MOVEMENT", label: "Everyday movement", description: "Local handoffs, parcels, and practical order movement." },
  { id: "BUSINESS_FLOW", label: "Business flow", description: "Repeat operations, preparation, and account-based coordination." },
  { id: "PLANNED_MOVEMENT", label: "Planned movement", description: "Requests that need more planning and confirmation." },
  { id: "QUOTE_INTELLIGENCE", label: "Quote intelligence", description: "The information that shapes a current request." },
] as const;

export function getPublicServicePage(id: PublicServiceId): PublicServicePageDefinition {
  const service = publicServicePages.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`Unknown public service page: ${id}`);
  return service;
}

export function getServicesByFamily(family: PublicServiceFamily): readonly PublicServicePageDefinition[] {
  return publicServicePages.filter((service) => service.family === family);
}

export const indexablePublicServicePages = publicServicePages.filter((service) => service.indexable);

export function publicServiceMetadata(id: PublicServiceId): Metadata {
  const service = getPublicServicePage(id);
  return publicPageMetadata({ title: service.metadataTitle, description: service.metadataDescription, route: service.route });
}
