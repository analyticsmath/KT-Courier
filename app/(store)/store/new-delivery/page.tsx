import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { DeliveryRequestForm, type DefaultPickupAddress } from "@/components/forms/DeliveryRequestForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRepeatDeliveryPrefill } from "@/lib/services/orders.service";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";

export const metadata: Metadata = { title: "New store delivery" };

export default async function StoreNewDeliveryPage({ searchParams }: { searchParams: Promise<{ repeatFrom?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { repeatFrom } = await searchParams;
  const [pickupState, repeatPrefill] = await Promise.all([getStorePickupAddress(user.id), repeatFrom ? getRepeatDeliveryPrefill(user, repeatFrom) : Promise.resolve(null)]);
  if (repeatFrom && !repeatPrefill) notFound();
  let defaultPickupAddress: DefaultPickupAddress | undefined;
  if (pickupState?.pickupAddress) {
    const address = pickupState.pickupAddress;
    defaultPickupAddress = { contactName: address.contactName ?? undefined, contactPhone: address.contactPhone ?? undefined, line1: address.line1, line2: address.line2, city: address.city ?? undefined, province: address.province, postalCode: address.postalCode, country: address.country, accessNotes: address.accessNotes ?? undefined, formattedAddress: address.formattedAddress, placeId: address.placeId, latitude: address.latitude, longitude: address.longitude };
  } else if (pickupState?.store.addressLine1) {
    const store = pickupState.store;
    defaultPickupAddress = { contactName: store.contactName ?? store.name ?? undefined, contactPhone: store.contactPhone ?? undefined, line1: store.addressLine1 ?? undefined, line2: store.addressLine2, city: store.city ?? undefined, province: store.province, postalCode: store.postalCode, country: store.country };
  }
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Courier delivery" title={repeatPrefill ? "Create similar delivery" : "New delivery request"} description={repeatPrefill ? "Review copied request details before submitting a new store-owned courier delivery." : defaultPickupAddress ? "Your saved pickup address is available in the canonical delivery request form." : "Add the store pickup and destination details in the canonical delivery request form."} /><DeliveryRequestForm defaultPickupAddress={defaultPickupAddress} repeatPrefill={repeatPrefill} ordersHref="/store/orders" /></ProtectedPageFrame>;
}
