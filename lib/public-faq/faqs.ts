import { serviceFaqs } from "@/lib/public-services/service-page-registry";

export type PublicFaqItem = { question: string; answer: string };
export type PublicFaqSection = {
  id: "request" | "quote" | "coverage" | "orders" | "business" | "network" | "membership" | "support";
  title: string;
  items: readonly PublicFaqItem[];
};

/** Source-backed public guidance; live quote, payment and coverage engines remain authoritative. */
export const publicFaqSections = [
  {
    id: "request",
    title: "Booking a delivery",
    items: [
      serviceFaqs.request,
      serviceFaqs.scheduled,
      { question: "What details should I have ready?", answer: "Prepare the collection and delivery addresses, recipient contact details, parcel size and weight where applicable, and a clear description of the item. Add relevant access or handling notes when needed." },
      { question: "Do I need an account to get a quote?", answer: "No. You can request a delivery quotation without registering. An account is required when you continue to protected booking, payment or account-management features." },
    ],
  },
  {
    id: "quote",
    title: "Quotes and payment",
    items: [
      serviceFaqs.pricing,
      { question: "Is the price the same for every parcel?", answer: "Not necessarily. Pricing depends on the service, parcel details, applicable delivery route and any configured service or area rules. Review the actual quote before booking." },
      { question: "Is cash on delivery available for every order?", answer: "No. Cash collection arrangements, when offered, are subject to store, service, area, order and administrative eligibility. The available payment method is confirmed in the applicable checkout flow." },
    ],
  },
  {
    id: "coverage",
    title: "Delivery areas",
    items: [
      serviceFaqs.coverage,
      { question: "Can I shop from a store outside my delivery area?", answer: "Store visibility across South Africa is different from an available courier route. Delivery can only be confirmed where the required service and operational areas are active." },
      { question: "Is same-day delivery available everywhere?", answer: "No. Express and same-day availability depends on enabled operational areas, capacity and the particulars of the request. The quote flow or KT Couriers team can confirm what is currently available." },
    ],
  },
  {
    id: "orders",
    title: "Orders and deliveries",
    items: [
      serviceFaqs.orders,
      { question: "What happens if my delivery cannot be completed?", answer: "A failed delivery may require further contact, an updated delivery instruction or another arrangement. The reason, fees and available remedies depend on the circumstances and the published shipping and refund policies." },
      { question: "How do I report a missing, damaged or incorrect order?", answer: "Contact support@ktcouriers.com as soon as reasonably possible. Include the order number, a description of the issue and photographs or other evidence where relevant. The team can investigate with the vendor or delivery partner." },
      { question: "When will an approved refund be processed?", answer: "Approved refunds are generally submitted for processing within seven business days after approval. The time for funds to appear depends on the bank and payment provider. Statutory rights continue to apply." },
    ],
  },
  {
    id: "business",
    title: "Businesses and stores",
    items: [
      serviceFaqs.business,
      { question: "Can store delivery fees differ from one store to another?", answer: "Yes. Store-specific delivery arrangements may differ from standard courier tariffs. The applicable price and conditions should be confirmed through the quote or checkout experience." },
      { question: "Is there a walk-in KT Couriers office?", answer: "KT Couriers currently operates online and does not provide a public walk-in office. Please use the website or contact the team to arrange the appropriate next step." },
    ],
  },
  {
    id: "network",
    title: "Joining the network",
    items: [
      serviceFaqs.driver,
      { question: "Does signing up make a driver immediately eligible for jobs?", answer: "No. Registration begins onboarding. Identity, licence, vehicle and service-region requirements must be reviewed and approved before an eligible driver can receive dispatch opportunities." },
    ],
  },
  {
    id: "membership",
    title: "Membership",
    items: [
      { question: "Can I activate a membership online?", answer: "Online membership activation and checkout are not currently available. Contact KT Couriers to ask about current membership options or business arrangements." },
    ],
  },
  {
    id: "support",
    title: "Support and your information",
    items: [
      { question: "How can I contact KT Couriers?", answer: "Use the contact page or email support@ktcouriers.com for delivery queries, existing orders, business enquiries and general assistance. Include your order number when relevant." },
      { question: "How can I ask about my personal information?", answer: "Email support@ktcouriers.com and use “Privacy Request” as the subject line where possible. Our published Privacy Policy explains how personal information is handled and how privacy enquiries are assessed." },
      { question: "How can I report an accessibility problem?", answer: "Tell us which page or process you could not use, what you were trying to do and how to contact you. You can use the contact form or email support@ktcouriers.com. Do not send passwords or verification codes." },
    ],
  },
] as const satisfies readonly PublicFaqSection[];

export const allPublicFaqItems = publicFaqSections.flatMap((section) => section.items);

export function publicFaqJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allPublicFaqItems.map((item) => ({
      "@type": "Question", name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }).replace(/</g, "\\u003c");
}
