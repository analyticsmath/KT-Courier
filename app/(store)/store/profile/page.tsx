import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoreProfileForm } from "@/components/forms/StoreProfileForm";
import { StorePickupAddressManager } from "@/components/store/StorePickupAddressManager";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreProfile } from "@/lib/services/profiles.service";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";

export const metadata: Metadata = { title: "Store settings" };

export default async function StoreProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const [profile, pickupState] = await Promise.all([getStoreProfile(user.id), getStorePickupAddress(user.id)]);
  const defaultValues = { storeName: profile?.storeProfile?.storeName ?? profile?.store?.name ?? "", contactPerson: profile?.storeProfile?.contactPerson ?? profile?.user.name ?? "", businessPhone: profile?.storeProfile?.businessPhone ?? "", businessEmail: profile?.storeProfile?.businessEmail ?? "", addressLine1: profile?.store?.address.addressLine1 ?? "", addressLine2: profile?.store?.address.addressLine2 ?? "", city: profile?.store?.address.city ?? "", province: profile?.store?.address.province ?? "", postalCode: profile?.store?.address.postalCode ?? "" };
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Store account" title="Store settings" description="Manage canonical store identity, contact, and collection-address records." /><OperationalPanel title="Store identity" description="Existing validation and save authority remain inside this form." padding="compact"><StoreProfileForm defaultValues={defaultValues} userEmail={profile?.user.email ?? ""} /></OperationalPanel><OperationalPanel title="Pickup address" description="The saved address is used by the existing store delivery request workflow." padding="compact"><StorePickupAddressManager pickupAddress={pickupState?.pickupAddress ?? null} legacyAddress={{ storeName: profile?.store?.name, contactName: profile?.store?.contactName, contactPhone: profile?.store?.contactPhone, line1: profile?.store?.address.addressLine1, line2: profile?.store?.address.addressLine2, city: profile?.store?.address.city, province: profile?.store?.address.province, postalCode: profile?.store?.address.postalCode, country: profile?.store?.address.country }} /></OperationalPanel></ProtectedPageFrame>;
}
