import type { HomepageFaqItem } from "./HomepageFaq";
import { SignatureHomepage } from "./SignatureHomepage";

export async function HomepageV2({ faqItems }: { faqItems: readonly HomepageFaqItem[] }) {
  return <SignatureHomepage faqItems={faqItems} />;
}
