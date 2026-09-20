import Link from "next/link";
import styles from "./commerce.module.css";

export function CheckoutReferenceState({
  title,
  description,
  reference,
}: {
  title: string;
  description: string;
  reference: string;
}) {
  return (
    <main className={styles.commerceRoot}>
      <section aria-live="polite" className={`${styles.commerceInner} ${styles.checkoutStateWrap}`}>
        <p className={styles.productTileBrand}>Checkout</p>
        <h1 className={styles.commerceTitle}>{title}</h1>
        <p className={styles.commerceLead}>{description}</p>
        <div className={styles.checkoutReference}>{reference}</div>
        <div className={styles.productActionRow}>
          <Link className={`${styles.productActionButton} ${styles.productActionButtonPrimary}`} href={`/checkout?ref=${encodeURIComponent(reference)}`}>Return to checkout</Link>
          <Link className={styles.productActionButton} href="/shop">Continue shopping</Link>
        </div>
      </section>
    </main>
  );
}
