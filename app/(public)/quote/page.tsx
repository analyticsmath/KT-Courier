import { EditorialMotion } from "@/components/public-v3/redesign/EditorialMotion";
import styles from "@/components/public-v3/foundation/utility-experience.module.css";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
import { type DefaultPickupAddress } from "@/components/forms/DeliveryRequestForm";
import { listCustomerAddresses } from "@/lib/services/customer-addresses.service";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
export const metadata = publicPageMetadata({
  title: "Delivery quote",
  description: "Calculate your delivery price before creating an account.",
  route: "/quote",
});
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const [u, p] = await Promise.all([getCurrentUser(), searchParams]);
  const [savedAddresses, pickupState] = await Promise.all([
    u?.role === "CUSTOMER" ? listCustomerAddresses(u.id).catch(() => []) : Promise.resolve([]),
    u?.role === "STORE" ? getStorePickupAddress(u.id, "deliveries").catch(() => null) : Promise.resolve(null),
  ]);
  let defaultPickupAddress: DefaultPickupAddress | undefined;
  if (pickupState?.pickupAddress) {
    const address = pickupState.pickupAddress;
    defaultPickupAddress = {
      contactName: address.contactName ?? undefined,
      contactPhone: address.contactPhone ?? undefined,
      line1: address.line1,
      line2: address.line2,
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
    <EditorialMotion>
      <article className={styles.utility}>
        <div className={styles.inner}>
          <header className={styles.head}>
            <h1 data-split-heading className={styles.title}>
              Get a delivery quote.
            </h1>
            <p className={styles.description}>
              Enter your collection and destination addresses, choose a parcel
              size and service, and get a quote before you book. No account
              needed to start. At booking, choose online payment or cash on
              delivery only if approved for your route, service and amount.
            </p>
          </header>
          <div className={`${styles.body} ${styles.quoteBody}`}>
            <PublicDeliveryQuoteForm
              signedIn={u?.role === "CUSTOMER" || u?.role === "STORE"}
              business={u?.role === "STORE"}
              reference={p.reference}
              savedAddresses={savedAddresses}
              defaultPickup={defaultPickupAddress}
            />
          </div>
        </div>
      </article>
    </EditorialMotion>
  );
}
