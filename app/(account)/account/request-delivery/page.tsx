import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OperationalPanel } from "@/components/protected-v2";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { DeliveryRequestForm } from "@/components/forms/DeliveryRequestForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCustomerAddresses } from "@/lib/services/customer-addresses.service";
import { getRepeatDeliveryPrefill } from "@/lib/services/orders.service";

export const metadata: Metadata = { title: "Request a Delivery" };

export default async function RequestDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ repeatFrom?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { repeatFrom } = await searchParams;
  const [savedAddresses, repeatPrefill] = await Promise.all([
    listCustomerAddresses(user.id),
    repeatFrom ? getRepeatDeliveryPrefill(user, repeatFrom) : Promise.resolve(null),
  ]);

  if (repeatFrom && !repeatPrefill) notFound();

  return (
    <CustomerPage
      eyebrow="New delivery"
      title={repeatPrefill ? "Create similar delivery" : "Request a delivery"}
      description={repeatPrefill ? "Review the copied details before requesting a new delivery." : "Enter the delivery details, then review the server-issued quote before you submit."}
    >
      <OperationalPanel title="Delivery request" description="Pricing, delivery-region checks, and submission remain server-authoritative.">
      <DeliveryRequestForm
        savedAddresses={savedAddresses}
        repeatPrefill={repeatPrefill}
        ordersHref="/account/orders"
      />
      </OperationalPanel>
    </CustomerPage>
  );
}
