import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Promotions" };

export default function PromotionsPage() {
  return <CustomerUnavailablePage eyebrow="Account offers" title="Promotions" description="Review account offers when they are backed by an active customer projection." stateTitle="Promotion redemption is unavailable" stateDescription="No connected customer promotion balance or redemption workflow is available on this route." />;
}
