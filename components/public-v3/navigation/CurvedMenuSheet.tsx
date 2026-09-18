"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";

interface CurvedMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tone?: "light" | "dark";
}

export function CurvedMenuSheet({
  isOpen,
  onClose,
  tone = "light",
}: CurvedMenuSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Esc closes menu & focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const isDark = tone === "dark";

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Dimmed backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-grayscale-[20%] transition-opacity duration-500 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Curved leading edge sheet */}
      <aside
        ref={containerRef}
        className={`absolute top-0 right-0 bottom-0 w-full max-w-[540px] p-8 sm:p-12 overflow-y-auto transition-transform duration-[580ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full"
        } ${
          isDark
            ? "bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)]"
            : "bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)]"
        }`}
        style={{
          boxShadow: "var(--kt-shadow-sheet)",
          borderTopLeftRadius: "24px",
          borderBottomLeftRadius: "24px",
        }}
      >
        {/* Header inside drawer */}
        <div className="flex items-center justify-between pb-8 border-b border-current/15">
          <div className="flex items-center gap-3">
            <CanonicalKtLogo size={36} />
            <span className="font-display font-extrabold uppercase tracking-tight text-sm">
              KT Couriers
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-2 -mr-2 hover:opacity-70 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Primary Links */}
        <nav aria-label="Expanded primary" className="py-8">
          <ul className="space-y-4 text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
            <li>
              <Link
                href="/shop"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Shop
              </Link>
            </li>
            <li>
              <Link
                href="/services/parcel"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Send a parcel
              </Link>
            </li>
            <li>
              <Link
                href="/services"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Delivery services
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                About KT
              </Link>
            </li>
            <li>
              <Link
                href="/coverage-areas"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Where we deliver
              </Link>
            </li>
            <li>
              <Link
                href="/join"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Join the network
              </Link>
            </li>
            <li>
              <Link
                href="/careers"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={onClose}
                className="hover:text-[var(--kt-brand-blue)] transition-colors block"
              >
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        {/* Secondary Links & Utility */}
        <div className="pt-8 border-t border-current/15 flex flex-col gap-6 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-medium opacity-80">
            <Link href="/faq" onClick={onClose} className="hover:opacity-100">
              FAQ
            </Link>
            <Link href="/safety" onClick={onClose} className="hover:opacity-100">
              Safety
            </Link>
            <Link href="/accessibility" onClick={onClose} className="hover:opacity-100">
              Accessibility
            </Link>
            <Link href="/terms" onClick={onClose} className="hover:opacity-100">
              Terms & Legal
            </Link>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-current/10">
            <Link
              href="/login"
              onClick={onClose}
              className="text-xs font-semibold uppercase tracking-wider px-4 py-2 border border-current hover:bg-current hover:text-[var(--kt-bg-primary)] transition-colors"
            >
              Customer / Store Sign In
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
