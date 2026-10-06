import { PublishedPolicyPage, publishedPolicyMetadata } from "@/components/public-v2/legal/PublishedPolicyPage";

export async function generateMetadata() { return publishedPolicyMetadata("refund-policy"); }
export default function RefundPolicyPage() { return <PublishedPolicyPage documentId="refund-policy" />; }
