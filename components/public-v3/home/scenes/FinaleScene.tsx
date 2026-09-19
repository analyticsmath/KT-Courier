"use client";

import Link from "next/link";
import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { CanonicalKtLogo } from "../../brand/CanonicalKtLogo";

interface FinaleSceneProps {
  className?: string;
}

/**
 * Chapter 11 — Finale & Narrative Resolution.
 * Negative space expands, emotional resolution settles into giant KT COURIER identity,
 * anchored by a narrow photographic ground strip of the night transit corridor.
 */
export function FinaleScene({ className = "" }: FinaleSceneProps) {
  const groundStrip = ktMediaV3.editorial.route.nightTransit;

  return (
    <section
      className={`relative min-h-[90vh] flex flex-col justify-between items-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-20 px-6 md:px-12 text-center overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="finale"
      aria-label="KT Couriers Finale"
    >
      <div className="pt-6 flex flex-col items-center relative z-10">
        <CanonicalKtLogo size={56} className="mb-4" />
        <span className="text-xs font-mono font-medium tracking-widest uppercase text-[var(--kt-graphite)]">
          South African Commerce & Logistics
        </span>
      </div>

      {/* Enormous Monumental Identity */}
      <div className="my-auto py-8 relative z-10">
        <h2 className="font-display text-[clamp(3.5rem,13vw,11rem)] font-extrabold tracking-tighter leading-none text-[var(--kt-asphalt)] uppercase select-none">
          KT COURIER
        </h2>
        <p className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[var(--kt-graphite)] mt-4">
          Shop local. Send anywhere. Move with KT.
        </p>
      </div>

      {/* Narrow Photographic Ground Anchor Strip */}
      <div className="w-full max-w-4xl h-16 sm:h-20 relative overflow-hidden my-4 border-y border-[var(--kt-concrete)]/60 z-10">
        <Image
          src={groundStrip.src}
          alt={groundStrip.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 896px"
          className="object-cover object-center filter grayscale contrast-125 brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--kt-freight-paper)] via-transparent to-[var(--kt-freight-paper)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-mono tracking-widest text-[var(--kt-freight-paper)] bg-[var(--kt-asphalt)]/70 px-3 py-1 uppercase">
            Gauteng &bull; Western Cape &bull; KwaZulu-Natal &bull; Cross-Border
          </span>
        </div>
      </div>

      {/* Direct Action Anchors */}
      <div className="pb-6 flex flex-wrap items-center justify-center gap-4 relative z-10">
        <Link
          href="/shop"
          className="inline-flex items-center justify-center px-8 py-4 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] font-bold text-xs uppercase tracking-wider hover:bg-[#23272B] transition-colors"
        >
          Explore Marketplace &rarr;
        </Link>
        <Link
          href="/services/parcel"
          className="inline-flex items-center justify-center px-8 py-4 border-2 border-[var(--kt-asphalt)] text-[var(--kt-asphalt)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--kt-asphalt)] hover:text-[var(--kt-freight-paper)] transition-colors"
        >
          Send a Parcel &rarr;
        </Link>
      </div>
    </section>
  );
}
