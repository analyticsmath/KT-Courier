"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { CurvedMenuSheet } from "./CurvedMenuSheet";
import { useMotionContext } from "../motion/PublicMotionProvider";

interface PublicHeaderProps {
  className?: string;
}

export function PublicHeader({ className = "" }: PublicHeaderProps) {
  const { headerTone } = useMotionContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);

  // Sync real live cart count
  useEffect(() => {
    let active = true;
    const fetchCartCount = async () => {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.cart) {
          const count = (data.cart.lines || []).reduce(
            (acc: number, line: { quantity: number }) => acc + line.quantity,
            0
          );
          setCartCount(count);
        }
      } catch {
        // Fallback silently if offline or initial load
      }
    };

    fetchCartCount();

    const onCartUpdated = () => fetchCartCount();
    window.addEventListener("kt-cart-updated", onCartUpdated);
    return () => {
      active = false;
      window.removeEventListener("kt-cart-updated", onCartUpdated);
    };
  }, []);

  const isDark = headerTone === "dark";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-12 h-[66px] transition-colors duration-[160ms] ease-out ${
          isDark
            ? "bg-[var(--kt-asphalt)] text-[var(--kt-freight-paper)] border-b border-[#23272B]"
            : "bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] border-b border-[var(--kt-concrete)]/40"
        } ${className}`}
        role="banner"
      >
        {/* Left: Canonical Brand Logo */}
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="KT Couriers Home"
            className="flex items-center transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            <CanonicalKtLogo size={34} priority />
          </Link>
        </div>

        {/* Center: Primary Actions */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8 font-medium text-sm tracking-wide"
        >
          <Link
            href="/shop"
            className="hover:text-[var(--kt-brand-blue)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            Shop
          </Link>
          <Link
            href="/services/parcel"
            className="hover:text-[var(--kt-brand-blue)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            Send a parcel
          </Link>
          <Link
            href="/services"
            className="hover:text-[var(--kt-brand-blue)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            Services
          </Link>
        </nav>

        {/* Right: Search, Cart, Account, Menu trigger */}
        <div className="flex items-center gap-5">
          <Link
            href="/shop/search"
            aria-label="Search marketplace"
            className="p-1.5 hover:text-[var(--kt-brand-blue)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
          </Link>

          <Link
            href="/cart"
            aria-label={`Shopping cart containing ${cartCount} items`}
            data-kt-cart-target="header"
            className="relative p-1.5 hover:text-[var(--kt-brand-blue)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--kt-brand-blue)] text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            href="/login"
            className="hidden sm:inline-block text-xs font-semibold tracking-wide uppercase px-3 py-1.5 border border-current rounded-none hover:bg-current hover:text-[var(--kt-bg-primary)] transition-colors"
          >
            Account
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open expanded navigation menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 p-1.5 hover:text-[var(--kt-brand-blue)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)]"
          >
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
              Menu
            </span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Expanded Menu Drawer */}
      <CurvedMenuSheet
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        tone={isDark ? "dark" : "light"}
      />
    </>
  );
}
