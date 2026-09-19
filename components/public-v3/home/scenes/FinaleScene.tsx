"use client";

import Link from "next/link";
import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { CanonicalKtLogo } from "../../brand/CanonicalKtLogo";

interface FinaleSceneProps {
  className?: string;
}

/**
 * Chapter 11 — Finale & Single Ending Horizon (Unified Finale + Footer).
 * Law 6: The site ends once. Arrival -> Finale -> Footer is one composed final world (~110-125vh).
 * Structure:
 * 1. Small canonical mark & subordinate utility links above
 * 2. GIANT KT COURIER monumental identity (~85-92vw visual width)
 * 3. Night transit route strip crossing the lower type area
 * 4. Legal / terms / copyright at the bottom
 */
export function FinaleScene({ className = "" }: FinaleSceneProps) {
  const groundStrip = ktMediaV3.editorial.route.nightTransit;

  return (
    <footer
      id="site-finale-horizon"
      className={`relative min-h-[115vh] flex flex-col justify-between bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] pt-20 pb-12 px-6 md:px-12 overflow-hidden ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="finale"
      role="contentinfo"
      aria-label="KT Couriers Brand Horizon & Directory"
    >
      {/* 1. Upper Utility Layer: Brand statement & subordinate directory */}
      <div className="w-full max-w-6xl mx-auto relative z-20">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 pb-12 border-b border-[#23272B]/80">
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center gap-3">
              <CanonicalKtLogo size={36} />
              <span className="font-display font-extrabold text-lg tracking-tight uppercase text-white">
                KT COURIER
              </span>
            </div>
            <p className="text-sm text-[var(--kt-concrete)] leading-relaxed">
              Shop local. Send with KT. Connecting South African stores, customers, and independent courier delivery.
            </p>
            <div className="pt-2 flex items-center gap-4">
              <Link
                href="/shop"
                className="kt-action-filled text-xs py-2 px-4 inline-flex"
              >
                Shop marketplace
              </Link>
              <Link
                href="/services/parcel"
                className="kt-action-outline text-xs py-2 px-4 inline-flex !border-[var(--kt-concrete)]/40 !text-[var(--kt-freight-paper)] hover:!bg-[var(--kt-freight-paper)] hover:!text-[var(--kt-asphalt)]"
              >
                Send a parcel
              </Link>
            </div>
          </div>

          {/* Subordinate Navigation Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-12 text-xs">
            <div>
              <span className="font-mono font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
                Services
              </span>
              <ul className="space-y-2 text-[var(--kt-concrete)]">
                <li>
                  <Link href="/services/parcel" className="hover:text-white transition-colors">
                    Parcel & documents
                  </Link>
                </li>
                <li>
                  <Link href="/services/ecommerce" className="hover:text-white transition-colors">
                    E-commerce
                  </Link>
                </li>
                <li>
                  <Link href="/services/food" className="hover:text-white transition-colors">
                    Food & dining
                  </Link>
                </li>
                <li>
                  <Link href="/services/grocery" className="hover:text-white transition-colors">
                    Grocery staples
                  </Link>
                </li>
                <li>
                  <Link href="/services/freight" className="hover:text-white transition-colors">
                    Heavy freight
                  </Link>
                </li>
                <li>
                  <Link href="/services/pricing" className="hover:text-white transition-colors">
                    Delivery pricing
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <span className="font-mono font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
                Explore
              </span>
              <ul className="space-y-2 text-[var(--kt-concrete)]">
                <li>
                  <Link href="/shop" className="hover:text-white transition-colors">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link href="/shop/stores" className="hover:text-white transition-colors">
                    Local stores
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About KT
                  </Link>
                </li>
                <li>
                  <Link href="/coverage-areas" className="hover:text-white transition-colors">
                    Where we deliver
                  </Link>
                </li>
                <li>
                  <Link href="/join" className="hover:text-white transition-colors">
                    Join network
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="font-mono font-bold uppercase tracking-widest text-[var(--kt-road-grey)] block mb-3">
                Information
              </span>
              <ul className="space-y-2 text-[var(--kt-concrete)]">
                <li>
                  <Link href="/contact" className="hover:text-white transition-colors">
                    Contact team
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-white transition-colors">
                    Frequently asked
                  </Link>
                </li>
                <li>
                  <Link href="/safety" className="hover:text-white transition-colors">
                    Safety & trust
                  </Link>
                </li>
                <li>
                  <Link href="/accessibility" className="hover:text-white transition-colors">
                    Accessibility
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Monumental Brand Horizon Identity */}
      <div className="w-full my-auto py-12 text-center relative z-10 select-none kt-finale-identity-wrapper">
        <h2 className="kt-finale-giant-type font-display text-[clamp(6rem,17vw,17rem)] font-black tracking-tighter leading-none text-[var(--kt-freight-paper)] uppercase opacity-95 will-change-transform flex flex-col items-center justify-center">
          <span data-motion="finale-kt" className="kt-finale-word-kt inline-block will-change-transform">
            KT
          </span>
          <span data-motion="finale-courier" className="kt-finale-word-courier inline-block will-change-transform -mt-2 sm:-mt-6">
            COURIER
          </span>
        </h2>
        <p className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[var(--kt-concrete)] mt-2">
          Shop local &bull; Send anywhere &bull; Move with KT
        </p>
      </div>

      {/* 3. Photographic Ground Corridor Strip Crossing Beneath Lower Type */}
      <div
        data-motion="finale-road"
        className="w-full max-w-5xl mx-auto h-20 sm:h-24 relative overflow-hidden my-4 border-y border-[#23272B] z-10 kt-finale-ground-strip will-change-transform"
      >
        <Image
          src={groundStrip.src}
          alt={groundStrip.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover object-center filter grayscale contrast-125 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--kt-asphalt)] via-transparent to-[var(--kt-asphalt)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-mono tracking-widest text-[var(--kt-freight-paper)] bg-[var(--kt-asphalt)]/80 px-4 py-1.5 uppercase border border-[#23272B]">
            South African Commerce & Logistics Corridor
          </span>
        </div>
      </div>

      {/* 4. Bottom Legal & Copyright Horizon */}
      <div className="w-full max-w-6xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--kt-road-grey)] gap-4 relative z-20 border-t border-[#23272B]/60">
        <p>&copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</p>
        <p className="font-medium text-[var(--kt-concrete)]">Shop local. Send with KT.</p>
      </div>
    </footer>
  );
}
