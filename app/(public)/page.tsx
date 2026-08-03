import { HomepageV2 } from "@/components/public-v2/home";
import { publicPageMetadata, publicSiteMetadata } from "@/lib/public-site/site-metadata";

export const metadata = {
  ...publicPageMetadata({
    title: "Courier services",
    description: "Explore KT Couriers public courier-service information and use the account-based request flow for current delivery arrangements.",
    route: "/",
  }),
  title: { absolute: publicSiteMetadata.defaultTitle },
};

const faqItems = [
  {
    question: "How do I request courier services online?",
    answer:
      "Create an account and open the delivery request form. Add pickup details, drop off details, parcel notes and timing.",
  },
  {
    question: "Can stores use KT Couriers for local delivery?",
    answer:
      "Yes. Stores and local businesses can create an account for repeat delivery requests, active orders and delivery history.",
  },
  {
    question: "Can I request same day delivery?",
    answer:
      "You can submit a same day delivery request. KT Couriers will confirm availability for the pickup and drop off details.",
  },
  {
    question: "Does KT Couriers support scheduled delivery?",
    answer:
      "Yes. Choose a scheduled delivery type and add your preferred pickup date and time when you submit the request.",
  },
  {
    question: "What delivery tracking is available?",
    answer:
      "Customers and stores can view delivery status updates in the dashboard. This is status tracking, not live driver tracking.",
  },
  {
    question: "Where does KT Couriers operate?",
    answer:
      "KT Couriers operates in local service areas. Contact us to confirm your pickup and drop off locations.",
  },
];

export default function HomePage() {
  return <HomepageV2 faqItems={faqItems} />;
}
