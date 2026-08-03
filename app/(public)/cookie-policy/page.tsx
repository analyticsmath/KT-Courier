import { LegalDocumentPage } from "@/components/public-v2/legal";
import { legalDocumentMetadata } from "@/lib/public-legal/legal-document-registry";

export const metadata = legalDocumentMetadata("cookie-notice");

export default function CookiePolicyPage() {
  return <LegalDocumentPage documentId="cookie-notice" />;
}
