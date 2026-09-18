"use client";

import Link from "next/link";
import { CanonicalKtLogo } from "../../brand/CanonicalKtLogo";

interface FinaleSceneProps {
  className?: string;
}

/**
 * Scene 12 — Finale & Narrative Resolution.
 * Negative space expands, emotional resolution settles into giant KT COURIER identity,
 * followed by clear commerce and dispatch actions.
 */
export function FinaleScene({ className = "" }: FinaleSceneProps) {
  return (
    <section
      className={`relative min-h-[85vh] flex flex-col justify-between items-center bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-24 px-6 md:px-12 text-center overflow-hidden ${className}`}
      data-kt-contrast="light"
      data-kt-scene="finale"
      aria-label="KT Couriers Finale"
    >
      <div className="pt-8 flex flex-col items-center">
        <CanonicalKtLogo size={64} className="mb-6" />
        <span className="text-xs font-mono font-medium tracking-widest uppercase text-[var(--kt-road-grey)]">
          South African Commerce & Logistics
        </span>
      </div>

      {/* Enormous Monumental Identity */}
      <div className="my-auto py-8">
        <h2 className="font-display text-[clamp(4rem,14vw,12rem)] font-extrabold tracking-tighter leading-none text-[var(--kt-asphalt)] uppercase select-none">
          KT COURIER
        </h2>
        <p className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--kt-road-grey)] mt-4">
          Shop. Send. Move with KT.
        </p>
      </div>

      {/* Direct Action Anchors */}
      <div className="pb-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/shop"
          className="inline-flex items-center justify-center px-8 py-4 bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] font-bold text-xs uppercase tracking-wider hover:bg-[#23272B] transition-colors"
        >
          Explore Marketplace
        </Link>
        <Link
          href="/services/parcel"
          className="inline-flex items-center justify-center px-8 py-4 border-2 border-[var(--kt-asphalt)] text-[var(--kt-asphalt)] font-bold text-xs uppercase tracking-wider hover:bg-[var(--kt-asphalt)] hover:text-[var(--kt-freight-paper)] transition-colors"
        >
          Send a Parcel
        </Link>
      </div>
    </section>
  );
}
