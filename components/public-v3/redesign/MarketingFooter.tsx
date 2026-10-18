"use client";
import Link from "next/link";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { EditorialMotion } from "./EditorialMotion";

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
  return (
    <footer className="kt-new-footer">
      <EditorialMotion>
        <div className="kt-footer-invitation" data-reveal>
          <h2>
            Ready when
            <br />
            you are.
          </h2>
          <Link
            href="/quote"
            className="kt-footer-round-link"
            aria-label="Get a delivery quote"
          >
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="kt-footer-directory">
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
        <div
          className="kt-footer-wordmark"
          data-wordmark
          aria-label="KT Couriers"
        >
          <span aria-hidden="true">KT COURIERS</span>
        </div>
      </EditorialMotion>
      <div className="kt-footer-bottom">
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
