import styles from "@/components/public-v3/foundation/utility-experience.module.css";
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
    <article className={styles.utility}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <h1 className={styles.title}>The next move.<strong>Made clear.</strong></h1>
          <p className={styles.description}>
            Enter your collection and destination addresses, choose a parcel
            size and service, and get a quote before you book. No account needed to start.
          </p>
        </header>
        <div className={`${styles.body} ${styles.quoteBody}`}>
      <PublicDeliveryQuoteForm
        signedIn={u?.role === "CUSTOMER" || u?.role === "STORE"}
        business={u?.role === "STORE"}
        reference={p.reference}
      />
        </div>
      </div>
    </article>
  );
}
