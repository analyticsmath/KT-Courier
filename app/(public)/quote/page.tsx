import { getCurrentUser } from "@/lib/auth/current-user";
import { PublicDeliveryQuoteForm } from "@/components/forms/PublicDeliveryQuoteForm";
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
  return (
    <article className="mx-auto max-w-5xl px-6 py-20">
      <p className="mb-4 text-sm uppercase tracking-widest">
        Send with KT Couriers
      </p>
      <h1 className="mb-5 text-5xl">Your delivery, clearly priced.</h1>
      <p className="mb-10 max-w-2xl">
        Get a quotation without an account. Enter both addresses and choose your
        parcel size and service. Sign in when you are ready to book.
      </p>
      <PublicDeliveryQuoteForm
        signedIn={u?.role === "CUSTOMER" || u?.role === "STORE"}
        business={u?.role === "STORE"}
        reference={p.reference}
      />
    </article>
  );
}
