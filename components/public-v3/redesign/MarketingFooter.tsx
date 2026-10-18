"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { EditorialMotion } from "./EditorialMotion";

export function MarketingFooter() {
  const pathname = usePathname();
  const compact =
    pathname === "/cart" ||
    pathname.startsWith("/checkout") ||
    pathname === "/quote" ||
    pathname.startsWith("/track");
  return (
    <footer className={`kt-new-footer ${compact ? "kt-footer-compact" : ""}`}>
      {!compact && (
        <EditorialMotion>
          <div className="kt-footer-arrival">
            <div className="kt-footer-image">
              <Image
                data-parallax
                src="/media/public/home/kt-home-13-arrival.webp"
                alt="A recipient receiving a parcel at the door"
                fill
                sizes="(max-width:760px) 100vw, 43vw"
              />
            </div>
            <div data-reveal>
              <h2>
                Good to
                <br />
                get it there.
              </h2>
              <Link href="/quote" className="kt-pill">
                Get a delivery quote <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/track" className="kt-text-link">
                Track a delivery ↗
              </Link>
            </div>
          </div>
        </EditorialMotion>
      )}
      <div className="kt-footer-utility">
        <Link href="/" className="kt-new-brand" aria-label="KT Couriers home">
          <CanonicalKtLogo size={48} />
          <span>KT Couriers</span>
        </Link>
        <nav aria-label="Footer navigation">
          <Link href="/services/parcel">Send a parcel</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/services">Services</Link>
          <Link href="/coverage-areas">Coverage</Link>
          <Link href="/join">Join KT</Link>
          <Link href="/careers">Careers</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
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
