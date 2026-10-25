"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { EditorialMotion } from "./EditorialMotion";
import styles from "./marketing-footer.module.css";

const groups = [
  {
    title: "Make a move",
    links: [
      ["Send a parcel", "/services/parcel"],
      ["Get a quote", "/quote"],
      ["Track a delivery", "/track"],
      ["Shop local", "/shop"],
    ],
  },
  {
    title: "Discover KT",
    links: [
      ["Our story", "/about"],
      ["Delivery services", "/services"],
      ["Where we deliver", "/coverage-areas"],
      ["Contact us", "/contact"],
    ],
  },
  {
    title: "Work with us",
    links: [
      ["Join the network", "/join"],
      ["For your business", "/services/business"],
      ["Careers", "/careers"],
      ["Your account", "/login"],
    ],
  },
];
export function MarketingFooter() {
  const pathname = usePathname();
  const hasMobilePurchaseDock = pathname?.startsWith("/shop/products/") ?? false;
  return (
    <footer className={styles.footer} data-mobile-purchase-dock={hasMobilePurchaseDock ? "true" : undefined}>
      <EditorialMotion className="kt-footer-motion">
        <div className={styles.invitation} data-section-transition="open">
          <h2 data-split-heading>
            Ready when
            <br />
            you are.
          </h2>
          <Link
            href="/quote"
            className={styles.roundLink}
            aria-label="Get a delivery quote"
          >
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.directory} data-footer-directory>
          <Link href="/" className="kt-new-brand" aria-label="KT Couriers home">
            <CanonicalKtLogo size={76} priority={false} />
          </Link>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3>{group.title}</h3>
              {group.links.map(([label, href]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className={styles.wordmark} data-wordmark aria-label="KT Couriers">
          <span aria-hidden="true">KT COURIERS</span>
        </div>
      </EditorialMotion>
      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} KT Couriers (Pty) Ltd.</span>
        <nav aria-label="Policies">
          <Link href="/faq">Help</Link>
          <Link href="/privacy-policy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund-policy">Refunds</Link>
          <Link href="/shipping-policy">Shipping</Link>
          <Link href="/accessibility">Accessibility</Link>
          <Link href="/safety">Safety</Link>
        </nav>
        <span>Made by Valtum Studio</span>
      </div>
    </footer>
  );
}
