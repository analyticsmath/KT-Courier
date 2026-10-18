"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { useMarketplaceCartCount } from "../navigation/marketplace-cart-client";

const destinations = [
  ["Send a parcel", "/services/parcel"],
  ["Shop local", "/shop"],
  ["Delivery services", "/services"],
  ["Track a delivery", "/track"],
] as const;
export function MarketingNavigation() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const cartCount = useMarketplaceCartCount();
  useEffect(() => {
    // A persistent layout also survives Back/Forward, which do not click a menu link.
    // Native close dispatches onClose and releases the body lock without moving focus.
    dialog.current?.close();
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <a className="kt-new-skip" href="#main-content">
        Skip to content
      </a>
      <header className="kt-new-header">
        <Link className="kt-new-brand" href="/" aria-label="KT Couriers home">
          <CanonicalKtLogo size={45} priority />
        </Link>
        <nav className="kt-new-header-links" aria-label="Primary navigation">
          <Link href="/shop">Shop</Link>
          <Link
            href="/services/parcel"
            aria-current={pathname === "/services/parcel" ? "page" : undefined}
          >
            Send a parcel
          </Link>
          <Link href="/track">Track</Link>
        </nav>
        <div className="kt-new-header-tools">
          <Link
            className="kt-new-cart"
            href="/cart"
            aria-label={`Shopping bag, ${cartCount} items`}
            data-kt-cart-target="header"
          >
            <svg
              width="23"
              height="25"
              viewBox="0 0 24 26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 8h16l1 16H3L4 8Z" />
              <path d="M8 10V6a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{cartCount}</span>
          </Link>
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="kt-editorial-menu"
            onClick={() => {
              dialog.current?.showModal();
              setOpen(true);
            }}
          >
            Menu <span aria-hidden="true">{open ? "−" : "+"}</span>
          </button>
        </div>
      </header>
      <dialog
        ref={dialog}
        id="kt-editorial-menu"
        className="kt-new-menu"
        aria-label="Explore KT Couriers"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        data-lenis-prevent
      >
        <div className="kt-menu-top">
          <Link href="/" onClick={close} className="kt-new-brand">
            <CanonicalKtLogo size={45} />
          </Link>
          <button type="button" onClick={close} aria-label="Close navigation">
            Close <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="kt-menu-body">
          <nav aria-label="Expanded primary navigation">
            {destinations.map(([name, href]) => (
              <Link key={href} href={href} onClick={close}>
                {name}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </nav>
          <div className="kt-menu-image">
            <Image
              src="/media/public/home/kt-home-13-arrival.webp"
              alt="A parcel arriving at its destination"
              fill
              sizes="40vw"
            />
            <Link href="/quote" onClick={close}>
              Get a delivery quote ↗
            </Link>
          </div>
        </div>
        <nav className="kt-menu-secondary" aria-label="More from KT">
          <Link href="/about" onClick={close}>
            About KT
          </Link>
          <Link href="/coverage-areas" onClick={close}>
            Where we deliver
          </Link>
          <Link href="/join" onClick={close}>
            Join the network
          </Link>
          <Link href="/contact" onClick={close}>
            Contact
          </Link>
          <Link href="/login" onClick={close}>
            Your account ↗
          </Link>
        </nav>
        <nav className="kt-menu-legal" aria-label="Support and policies">
          <Link href="/faq" onClick={close}>
            Help
          </Link>
          <Link href="/safety" onClick={close}>
            Safety
          </Link>
          <Link href="/accessibility" onClick={close}>
            Accessibility
          </Link>
          <Link href="/privacy-policy" onClick={close}>
            Privacy
          </Link>
          <Link href="/terms" onClick={close}>
            Terms
          </Link>
        </nav>
      </dialog>
    </>
  );
}
