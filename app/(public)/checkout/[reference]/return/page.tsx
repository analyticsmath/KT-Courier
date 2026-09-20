import { CheckoutReferenceState } from "@/components/public-v2/commerce/CheckoutReferenceState";
export default async function CheckoutReferencePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <CheckoutReferenceState title="Confirming your payment" description="Payment confirmation may take a moment. Your order status will update when it is ready." reference={reference} />;
}
