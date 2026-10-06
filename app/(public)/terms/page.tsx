import { PublishedPolicyPage, publishedPolicyMetadata } from "@/components/public-v2/legal/PublishedPolicyPage";

export async function generateMetadata() { return publishedPolicyMetadata("website-terms"); }

export default function TermsPage() {
  return <PublishedPolicyPage documentId="website-terms" />;
}
