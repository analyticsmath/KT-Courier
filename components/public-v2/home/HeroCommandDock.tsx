import Link from "next/link";
import { anonymousTracking } from "@/components/public-v2/site/tracking-copy";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./homepage-v2.module.css";

export function HeroCommandDock() {
  return (
    <div className={styles.commandDock} data-kt-motion-layer="command">
      <Link className={styles.commandPrimary} href="/account/request-delivery">
        <span>Get a quote</span>
        <span aria-hidden="true">→</span>
      </Link>
      <Link className={styles.commandSecondary} href={marketplaceHref()}>
        <span>Shop the marketplace</span>
        <span aria-hidden="true">→</span>
      </Link>
      <p className={styles.trackingNote}><Link href={anonymousTracking.href}>{anonymousTracking.actionLabel}</Link> · {anonymousTracking.supportingText}</p>
    </div>
  );
}
