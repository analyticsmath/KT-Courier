import type { Metadata } from "next";
import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";
import { StorePickupAddressManager } from "@/components/store/StorePickupAddressManager";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export const metadata: Metadata = { title: "Store pickup address" };

export default async function StorePickupPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const { storeId } = await searchParams;
  const access = await requireBusinessPage("/store/pickup-address", storeId);
  const state = await getStorePickupAddress(access.user.id, "settings", access.store.id);
  const store = state?.store ?? access.store;
  const context = encodeURIComponent(access.store.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader eyebrow="Store collection" title="Pickup address" description={`Manage the collection address for ${store.name}.`} />
      <OperationalPanel title="Pickup address" description="This address is used for store courier requests.">
        <StorePickupAddressManager pickupAddress={state?.pickupAddress ?? null}
          endpoint={`/api/store/pickup-address?storeId=${context}`}
          legacyAddress={{ storeName: store.name, contactName: store.contactName, contactPhone: store.contactPhone,
            line1: store.addressLine1, line2: store.addressLine2, city: store.city, province: store.province,
            postalCode: store.postalCode, country: store.country }} />
      </OperationalPanel>
      <Link href={`/store/new-delivery?storeId=${context}`} className="underline">Back to new delivery</Link>
    </ProtectedPageFrame>
  );
}
