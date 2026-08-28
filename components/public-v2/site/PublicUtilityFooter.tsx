import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./public-shell.module.css";

const footerNavigationGroups = [
  {
    title: "Commerce & Delivery",
    links: [
      { label: "Marketplace", href: marketplaceHref() },
      { label: "Request Delivery", href: "/account/request-delivery" },
      { label: "Parcels & Documents", href: "/services/parcel" },
      { label: "Business Logistics", href: "/services/business" },
      { label: "Food & Grocery", href: "/services/food" },
      { label: "Coverage Areas", href: "/coverage-areas" },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Join the network", href: "/join" },
      { label: "For Stores", href: "/signup?role=store" },
      { label: "For Drivers", href: "/services/driver-network" },
      { label: "For Promoters", href: "/contact" },
      { label: "Membership", href: "/membership" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About KT Couriers", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Frequently Asked Questions", href: "/faq" },
      { label: "Contact Support", href: "/contact" },
    ],
  },
  {
    title: "Legal & Standards",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Website Terms", href: "/terms" },
      { label: "Cookie Notice", href: "/cookie-policy" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
] as const;

export function PublicUtilityFooter() {
  return (
    <footer className={styles.footerRoot}>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrandCol}>
          <Link aria-label="KT Couriers" href="/">
            <KtCouriersWordmark compactMark />
          </Link>
          <p className={styles.footerDesc}>
            South African marketplace commerce and courier delivery services connected through an authenticated regional network.
          </p>
        </div>

        {footerNavigationGroups.map((group) => (
          <div key={group.title}>
            <h3 className={styles.footerGroupTitle}>{group.title}</h3>
            <ul className={styles.footerLinkList}>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link className={styles.footerLink} href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.footerBottom}>
        <p>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
        <div className={styles.footerBottomLinks}>
          <Link className={styles.footerLink} href="/privacy-policy">
            Privacy
          </Link>
          <Link className={styles.footerLink} href="/terms">
            Terms
          </Link>
          <Link className={styles.footerLink} href="/accessibility">
            Accessibility
          </Link>
        </div>
      </div>
    </footer>
  );
}
