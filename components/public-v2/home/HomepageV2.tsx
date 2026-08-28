import type { HomepageFaqItem } from "./HomepageFaq";
import { HomepageExperience } from "./HomepageExperience";

export async function HomepageV2({ faqItems }: { faqItems?: readonly HomepageFaqItem[] }) {
  return <HomepageExperience />;
}
