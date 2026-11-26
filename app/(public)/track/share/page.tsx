import type { Metadata } from "next";
import { TrackingShareClient } from "@/components/tracking/TrackingShareClient";
import { readTrackingGrantFromRequestCookies } from "@/lib/tracking/recipient-access.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared parcel tracking | KT Couriers",
  description: "Scoped recipient shipment status view for KT Couriers deliveries.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { g } = await searchParams;
  const projection = await readTrackingGrantFromRequestCookies(g ?? null);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-24 sm:px-6">
      <TrackingShareClient
        initialProjection={projection}
        expectedGrantRef={g ?? null}
      />
    </main>
  );
}
