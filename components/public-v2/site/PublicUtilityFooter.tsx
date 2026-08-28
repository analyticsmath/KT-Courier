import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./public-shell.module.css";

const footerSections = [
  {
    title: "Marketplace & Delivery",
    links: [
      { label: "Marketplace", href: marketplaceHref() },
      { label: "Send a parcel", href: "/account/request-delivery" },
      { label: "Parcels & documents", href: "/services/parcel" },
      { label: "Business logistics", href: "/services/business" },
      { label: "Food & kitchens", href: "/services/food" },
      { label: "Fresh grocery", href: "/services/grocery" },
      { label: "Coverage areas", href: "/coverage-areas" },
    ],
  },
  {
    title: "Network Participation",
    links: [
      { label: "Join the network", href: "/join" },
      { label: "For store partners", href: "/signup?role=store" },
      { label: "Driver network", href: "/services/driver-network" },
      { label: "Movement atlas", href: "/services" },
      { label: "Membership", href: "/membership" },
    ],
  },
  {
    title: "Company & Information",
    links: [
      { label: "About KT Couriers", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact support", href: "/contact" },
      { label: "Safety standards", href: "/safety" },
    ],
  },
  {
    title: "Legal & Access",
    links: [
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/cookie-policy" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
] as const;

export function PublicUtilityFooter() {
  return (
    <footer className={styles.footerRoot}>
      <div className={styles.footerInner}>
        <div className={styles.footerHeroRow}>
          <div className={styles.footerBrandBlock}>
            <Link aria-label="KT Couriers" className={styles.footerLogoLink} href="/">
              <KtCouriersWordmark compactMark />
            </Link>
            <p className={styles.footerManifesto}>
              South African marketplace ecosystem connecting local retailers, merchant kitchens, and independent senders with reliable courier delivery.
            </p>
          </div>

          <div className={styles.footerNavColumns}>
            {footerSections.map((sec) => (
              <div className={styles.footerNavGroup} key={sec.title}>
                <span className={styles.footerGroupHeader}>{sec.title}</span>
                <ul className={styles.footerLinkList}>
                  {sec.links.map((link) => (
                    <li key={link.href}>
                      <Link className={styles.footerNavLink} href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footerBottomBar}>
          <div className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. South Africa.
          </div>
          <div className={styles.footerBottomMeta}>
            <span>Marketplace & logistics network</span>
            <span>Gauteng & regional corridors</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
