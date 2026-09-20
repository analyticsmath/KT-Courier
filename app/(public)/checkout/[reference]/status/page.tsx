import { CheckoutReferenceState } from "@/components/public-v2/commerce/CheckoutReferenceState";
export default async function CheckoutReferencePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <CheckoutReferenceState title="Order status" description="Return to checkout to view the latest status and next step for your order." reference={reference} />;
}
