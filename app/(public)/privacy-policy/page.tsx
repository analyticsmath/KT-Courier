import { PublishedPolicyPage, publishedPolicyMetadata } from "@/components/public-v2/legal/PublishedPolicyPage";

export async function generateMetadata() { return publishedPolicyMetadata("privacy-notice"); }

export default function PrivacyPolicyPage() {
  return <PublishedPolicyPage documentId="privacy-notice" />;
}
