import { serviceFaqs } from "@/lib/public-services/service-page-registry";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

export type PublicFaqSection = {
  id: "request" | "quote" | "coverage" | "orders" | "business" | "network" | "membership" | "support";
  title: string;
  items: readonly PublicFaqItem[];
};

/**
 * The R7 public FAQ source extends the R6 service FAQ registry only where a
 * supporting-page state has a verified, public explanation.
 */
export const publicFaqSections = [
  {
    id: "request",
    title: "Requesting a delivery",
    items: [serviceFaqs.request, serviceFaqs.scheduled],
  },
  {
    id: "quote",
    title: "Quotes and pricing",
    items: [serviceFaqs.pricing],
  },
  {
    id: "coverage",
    title: "Coverage",
    items: [serviceFaqs.coverage],
  },
  {
    id: "orders",
    title: "Orders and account updates",
    items: [serviceFaqs.orders],
  },
  {
    id: "business",
    title: "Stores and business accounts",
    items: [serviceFaqs.business],
  },
  {
    id: "network",
    title: "Driver participation",
    items: [serviceFaqs.driver],
  },
  {
    id: "membership",
    title: "Membership",
    items: [
      {
        question: "Can I start a membership online?",
        answer: "Online membership activation and checkout are not currently available. Contact KT Couriers if you need current information about membership or business arrangements.",
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      {
        question: "How do I contact KT Couriers?",
        answer: "Use the contact form for delivery questions, business-account enquiries, existing-order help, pricing questions, or general support.",
      },
    ],
  },
] as const satisfies readonly PublicFaqSection[];

export const allPublicFaqItems = publicFaqSections.flatMap((section) => section.items);

export function publicFaqJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allPublicFaqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }).replace(/</g, "\\u003c");
}
