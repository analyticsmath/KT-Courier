"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";

const FOCUSABLE_SELECTOR = `a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])`;

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
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Keep a closed drawer out of keyboard navigation and contain focus while it is open.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    const container = containerRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab" || !container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      const focusIsOutside = !container.contains(document.activeElement);

      if (!first || !last) {
        e.preventDefault();
        container.focus();
      } else if (e.shiftKey && (document.activeElement === first || focusIsOutside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || focusIsOutside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    container?.querySelector<HTMLButtonElement>('button[aria-label="Close menu"]')?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  const isDark = tone === "dark";

  return (
    <div
      id="public-navigation-dialog"
      className={`fixed inset-0 z-[120] pointer-events-none transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="dialog"
      aria-modal={isOpen}
      aria-label="Navigation Menu"
    >
      {/* Dimmed backdrop */}
      <div
        className={`absolute inset-0 bg-[var(--kt-public-surface-inverse)]/40 backdrop-grayscale-[20%] transition-opacity duration-500 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Curved leading edge sheet */}
      <aside
        ref={containerRef}
        tabIndex={-1}
        data-tone={isDark ? "dark" : "light"}
        className={`absolute top-0 right-0 bottom-0 w-full max-w-[540px] p-8 sm:p-12 overflow-y-auto transition-transform duration-[580ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full"
        } ${
          isDark
            ? "bg-[var(--kt-public-surface-inverse)] text-[var(--kt-public-text-inverse)]"
            : "bg-[var(--kt-public-surface-primary)] text-[var(--kt-public-text-primary)]"
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
            className="p-2 -mr-2 hover:opacity-70 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
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
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Shop
              </Link>
            </li>
            <li>
              <Link
                href="/services/parcel"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Send a parcel
              </Link>
            </li>
            <li>
              <Link
                href="/services"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Delivery services
              </Link>
            </li>
            <li>
              <Link
                href="/track"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Track a delivery
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                About KT
              </Link>
            </li>
            <li>
              <Link
                href="/coverage-areas"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Where we deliver
              </Link>
            </li>
            <li>
              <Link
                href="/join"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Join the network
              </Link>
            </li>
            <li>
              <Link
                href="/careers"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Careers
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={onClose}
                className="hover:text-[var(--kt-public-interactive-text)] transition-colors block"
              >
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        {/* Secondary Links & Utility */}
        <div className="pt-8 border-t border-current/15 flex flex-col gap-6 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-medium">
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
              className="text-xs font-semibold uppercase tracking-wider px-4 py-2 border border-current hover:bg-current hover:text-[var(--kt-public-canvas)] transition-colors"
            >
              Customer / Store Sign In
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
