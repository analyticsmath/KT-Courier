import { EditorialInformationPage } from "@/components/public-v2/legal/EditorialInformationPage";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Accessibility",
  description: "Our approach to creating an accessible KT Couriers website, including how to request assistance or report an access barrier.",
  route: "/accessibility",
  noindex: true,
});

export default function AccessibilityPage() {
  return <EditorialInformationPage
    title="Accessibility for everyone."
    introduction="KT Couriers aims to make its online services straightforward to use, whether you are requesting a delivery, managing an account or looking for information."
    note="This page explains our current approach and feedback process. It is not a certification of compliance with a particular accessibility standard."
    highlights={[
      { title: "Practical access", description: "Clear language, readable layouts and access to essential tasks guide our website design." },
      { title: "More than one way to get help", description: "If a digital process is difficult to use, contact the team so we can discuss another way to assist." },
      { title: "Feedback makes a difference", description: "We welcome reports of barriers involving navigation, forms, content and assistive technology." },
    ]}
    sections={[
      { id: "our-approach", title: "Our approach", paragraphs: [
        "We work towards an experience that can be understood, navigated and used by people with different needs, devices and assistive technologies.",
        "That includes considering keyboard navigation, visible focus indicators, readable contrast, descriptive labels, adaptable layouts and reduced-motion preferences as the website evolves.",
      ] },
      { id: "using-the-website", title: "Using the website", paragraphs: [
        "You should be able to find important information and complete common tasks without relying solely on animation, colour or pointer-based interactions.",
        "Some services may require account verification or additional information for operational or security reasons. If a step creates an access difficulty, tell us which task you were trying to complete.",
      ] },
      { id: "reporting-a-barrier", title: "Report an accessibility barrier", paragraphs: [
        "If you encounter a barrier, email support@ktcouriers.com or use our contact form. Describe the page or process, what happened, the device or assistive technology you used if you are comfortable sharing it, and how we can contact you.",
        "Please do not include passwords, one-time passcodes, payment-card details or other sensitive credentials in an accessibility report.",
      ] },
      { id: "ongoing-improvement", title: "Ongoing improvement", paragraphs: [
        "We review accessibility feedback as the platform and its services change. Reported issues may require investigation and prioritisation based on their impact and the systems involved.",
        "This information will be revised when a formally reviewed accessibility statement and verified conformance assessment are available. We do not claim an accessibility certification that has not been independently established.",
      ] },
    ]}
    contactTitle="Finding something difficult to use?"
    contactBody="Describe the barrier and the outcome you need. We will use your feedback to investigate the issue and help you find a practical route forward."
  />;
}
