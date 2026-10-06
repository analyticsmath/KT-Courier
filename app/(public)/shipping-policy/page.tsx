import { PublishedPolicyPage, publishedPolicyMetadata } from "@/components/public-v2/legal/PublishedPolicyPage";

export async function generateMetadata() { return publishedPolicyMetadata("shipping-policy"); }
export default function ShippingPolicyPage() { return <PublishedPolicyPage documentId="shipping-policy" />; }
