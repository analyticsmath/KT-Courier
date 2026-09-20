import { CheckoutReferenceState } from "@/components/public-v2/commerce/CheckoutReferenceState";
export default async function CheckoutReferencePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <CheckoutReferenceState title="Payment not completed" description="You left the payment step. You can return to checkout to review your order and try again when you’re ready." reference={reference} />;
}
