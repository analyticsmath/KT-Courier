"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";

export function PublicFooter() {
  const pathname = usePathname();

  // Law 6: The site ends once. On homepage, FinaleScene provides the single unified brand horizon.
  if (pathname === "/") {
    return null;
  }

  return (
    <footer
      className="bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] pt-16 pb-24 md:pb-16 px-6 md:px-12 border-t border-[#23272B]"
      role="contentinfo"
    >
      <div className="max-w-[var(--kt-container-max)] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 pb-16 border-b border-[#23272B]">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <CanonicalKtLogo size={44} />
              <span className="font-display font-extrabold text-xl tracking-tight uppercase">
                KT COURIER
              </span>
            </div>
            <p className="text-sm text-[var(--kt-road-grey)] max-w-sm">
              Shop local. Send with KT. Connecting South African stores, customers, and independent courier delivery.
            </p>
          </div>

          {/* Col: Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--kt-road-grey)] mb-4">
              Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/services/parcel" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Parcel & documents
                </Link>
              </li>
              <li>
                <Link href="/services/ecommerce" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  E-commerce
                </Link>
              </li>
              <li>
                <Link href="/services/food" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Food
                </Link>
              </li>
              <li>
                <Link href="/services/grocery" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Grocery
                </Link>
              </li>
              <li>
                <Link href="/services/freight" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Freight & heavy loads
                </Link>
              </li>
              <li>
                <Link href="/services/pricing" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Pricing factors
                </Link>
              </li>
            </ul>
          </div>

          {/* Col: Marketplace & Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--kt-road-grey)] mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/shop" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/shop/stores" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Local stores
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  About KT
                </Link>
              </li>
              <li>
                <Link href="/coverage-areas" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Where we deliver
                </Link>
              </li>
              <li>
                <Link href="/join" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Join the network
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Col: Support & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--kt-road-grey)] mb-4">
              Information
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/contact" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Frequently asked
                </Link>
              </li>
              <li>
                <Link href="/safety" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Safety & trust
                </Link>
              </li>
              <li>
                <Link href="/accessibility" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Accessibility
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Terms of service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-[var(--kt-brand-blue)] transition-colors">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--kt-road-grey)] gap-4">
          <p>© {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
          <p className="font-medium">Shop local. Send with KT.</p>
        </div>
      </div>
    </footer>
  );
}
