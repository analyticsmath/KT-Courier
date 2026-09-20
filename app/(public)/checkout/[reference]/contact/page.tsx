import { CheckoutReferenceState } from "@/components/public-v2/commerce/CheckoutReferenceState";
export default async function CheckoutReferencePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <CheckoutReferenceState title="Contact details" description="Return to checkout to review the contact details for your order." reference={reference} />;
}
