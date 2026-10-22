import { EditorialInformationPage } from "@/components/public-v2/legal/EditorialInformationPage";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Safety and Delivery Standards",
  description: "Important guidance for preparing parcels, safe delivery handovers, restricted goods and reporting delivery incidents.",
  route: "/safety",
  noindex: true,
});

export default function SafetyPage() {
  return <EditorialInformationPage
    title="A safer way to send."
    introduction="Good deliveries start with clear information, responsible handling and a handover that can be verified. Here is what we ask of customers, businesses and delivery partners."
    highlights={[
      { title: "Prepare your parcel", description: "Use appropriate protective packaging and provide an accurate description of what is being transported." },
      { title: "Verify the handover", description: "Follow the confirmation instructions associated with your order, including any required delivery code or proof of delivery." },
      { title: "Report a concern", description: "If a parcel is missing, damaged, delayed or delivered incorrectly, contact support with your order reference." },
    ]}
    sections={[
      { id: "before-dispatch", title: "Before a delivery is arranged", paragraphs: [
        "Give the correct collection and delivery addresses, reachable contact details, an appropriate parcel description and any access or handling instructions relevant to the request.",
        "A quote or delivery request does not guarantee availability. KT Couriers checks supported service areas and other operational requirements before confirming an applicable service.",
      ] },
      { id: "prohibited-goods", title: "Restricted and prohibited goods", paragraphs: [
        "Do not submit prohibited, unlawful, dangerous or improperly packaged goods for collection. Particular products, including regulated medical items and high-risk shipments, may require additional checks, specialist handling or may be unsuitable for the service.",
        "KT Couriers may refuse or pause a request when necessary to verify the nature, safety or lawful transport of its contents. See the Shipping and Delivery Policy and applicable service terms for more detail.",
      ], points: [
        "Do not conceal a parcel’s contents or misdescribe goods.",
        "Do not tender loose, leaking, unstable or inadequately protected items.",
        "Confirm additional requirements before requesting transport of fragile, valuable or regulated goods.",
      ] },
      { id: "courier-verification", title: "Delivery-partner verification", paragraphs: [
        "Delivery partners are subject to the applicable onboarding and operational requirements. Dispatch eligibility involves identity, driving and vehicle documentation, relevant approvals and availability in an assigned service area.",
        "A driver profile, an availability indicator or a newly submitted document does not by itself establish dispatch approval.",
      ] },
      { id: "custody-and-confirmation", title: "Collection, custody and handover", paragraphs: [
        "Collection and delivery events may be recorded as the order moves through the delivery process. Proof-of-delivery information, recipient confirmation and one-time delivery codes may be required for certain handovers.",
        "Do not share a delivery confirmation code until you are satisfied that you are completing the relevant authorised handover. Never share account login codes or passwords with someone claiming to be a courier.",
      ] },
      { id: "problems-and-claims", title: "If something goes wrong", paragraphs: [
        "Report missing, damaged, incorrect or undelivered orders as soon as reasonably possible. Include your order reference, a factual description and photos where relevant.",
        "KT Couriers may review account records, delivery events and information from the relevant vendor or delivery partner. Any remedy remains subject to the applicable contract, refund policy and South African law.",
      ] },
    ]}
    contactTitle="Have a safety or delivery concern?"
    contactBody="Contact support with the order reference, what happened and the safest way to reach you. For urgent danger, contact the appropriate local emergency service."
  />;
}
