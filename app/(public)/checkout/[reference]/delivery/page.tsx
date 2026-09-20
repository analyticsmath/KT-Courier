import { CheckoutReferenceState } from "@/components/public-v2/commerce/CheckoutReferenceState";
export default async function CheckoutReferencePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <CheckoutReferenceState title="Delivery details" description="Return to checkout to review your address and the delivery options available for your order." reference={reference} />;
}
