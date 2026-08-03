import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import styles from "./public-site-shell.module.css";

const footerColumns = [
  {
    title: "Services",
    links: [
      { label: "Parcels and documents", href: "/services/parcel" },
      { label: "Business delivery", href: "/services/business" },
      { label: "Food and grocery", href: "/services/food" },
      { label: "Freight and moving", href: "/services/freight" },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Join the network", href: "/join" },
      { label: "For stores", href: "/join#stores" },
      { label: "For drivers", href: "/join#drivers" },
      { label: "For promoters", href: "/join#promoters" },
      { label: "Developers", href: "/developers" },
      { label: "Membership", href: "/membership" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About KT Couriers", href: "/about" },
      { label: "Coverage areas", href: "/coverage-areas" },
      { label: "Frequently asked questions", href: "/faq" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
  {
    title: "Support and legal",
    links: [
      { label: "Contact support", href: "/contact" },
      { label: "Privacy notice", href: "/privacy-policy" },
      { label: "Website terms", href: "/terms" },
      { label: "Cookie notice", href: "/cookie-policy" },
    ],
  },
] as const;

export function PublicFooterV2() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerLead}>
          <div>
            <Link aria-label="KT Couriers" className={styles.footerWordmark} href="/">
              <KtCouriersWordmark compactMark />
            </Link>
            <p>Courier delivery, fulfilment and account-based order updates for customers, stores and businesses.</p>
          </div>
          <Link className={styles.footerQuote} href="/account/request-delivery">
            Get a quote
          </Link>
        </div>

        <div className={styles.footerColumns}>
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.footerMeta}>
          <p>&copy; {new Date().getFullYear()} KT Couriers. All rights reserved.</p>
          <Link href="/contact">Contact support</Link>
        </div>
      </div>
    </footer>
  );
}
