import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
import { type DefaultPickupAddress } from "@/components/forms/DeliveryRequestForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRepeatDeliveryPrefill } from "@/lib/services/orders.service";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";
import { completeStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";

export const metadata: Metadata = { title: "New store delivery" };

export default async function StoreNewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ repeatFrom?: string; storeId?: string }>;
}) {
  const { repeatFrom, storeId } = await searchParams;
  await requireBusinessPage("/store/new-delivery", storeId);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [pickupState, repeatPrefill] = await Promise.all([
    getStorePickupAddress(user.id, "deliveries", storeId),
    repeatFrom
      ? getRepeatDeliveryPrefill(user, repeatFrom, true)
      : Promise.resolve(null),
  ]);
  if (repeatFrom && !repeatPrefill) notFound();
  const pickupReady = completeStorePickupAddress(pickupState?.pickupAddress);
  let defaultPickupAddress: DefaultPickupAddress | undefined;
  if (pickupState?.pickupAddress) {
    const address = pickupState.pickupAddress;
    defaultPickupAddress = {
      contactName: address.contactName ?? undefined,
      contactPhone: address.contactPhone ?? undefined,
      line1: address.line1,
      line2: address.line2,
      suburb: address.suburb ?? address.line2 ?? undefined,
      city: address.city ?? undefined,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      accessNotes: address.accessNotes ?? undefined,
      formattedAddress: address.formattedAddress,
      placeId: address.placeId,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  } else if (pickupState?.store.addressLine1) {
    const store = pickupState.store;
    defaultPickupAddress = {
      contactName: store.contactName ?? store.name ?? undefined,
      contactPhone: store.contactPhone ?? undefined,
      line1: store.addressLine1 ?? undefined,
      line2: store.addressLine2,
      city: store.city ?? undefined,
      province: store.province,
      postalCode: store.postalCode,
      country: store.country,
    };
  }
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Courier delivery"
        title={
          repeatPrefill ? "Create similar delivery" : "New delivery request"
        }
        description={
          repeatPrefill
            ? "Review copied request details before submitting a new store-owned courier delivery."
            : defaultPickupAddress
              ? "Your saved pickup address is available in the canonical delivery request form."
              : "Add the store pickup and destination details in the canonical delivery request form."
        }
      />
      {!pickupReady ? (
        <section role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-[var(--kt-ink-navy)]">
          <h2 className="font-semibold">Verify your store collection address to request a delivery</h2>
          <p>Delivery quotations must collect from the store’s saved, mapped pickup location. Confirm the street, suburb, four-digit postcode and map pin in your store profile first. Your store account and existing orders remain unchanged.</p>
          <Link href="/store/profile#pickup-address" className="inline-flex rounded-lg border border-[var(--kt-border-strong)] bg-white px-4 py-2 font-semibold underline">
            Configure verified store pickup
          </Link>
        </section>
      ) : (
        <PublicDeliveryQuoteForm
          signedIn
          business
          storeContextId={pickupState?.store?.id ?? null}
          defaultPickup={defaultPickupAddress}
          prefill={repeatPrefill}
        />
      )}
    </ProtectedPageFrame>
  );
}
