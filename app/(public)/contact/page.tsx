import { ContactPage } from "@/components/public-v2/contact";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Contact",
  description: "Contact KT Couriers about a delivery question, business account, existing order, pricing, or general support through the canonical enquiry form.",
  route: "/contact",
});

export default function ContactRoutePage() {
  return <ContactPage />;
}
