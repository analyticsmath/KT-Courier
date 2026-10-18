"use client";

import { type ReactNode } from "react";
import "./tokens.css";
import "./typography.css";
import { usePathname } from "next/navigation";
import { isProtectedCatalog } from "../redesign/route-family";
import "../redesign/redesign.css";

interface PublicVisualRootProps {
  children: ReactNode;
  className?: string;
}

/**
 * Public Visual Root for Public v3 Experience.
 * Establishes the authoritative token and typography boundary.
 * Strictly scoped so dashboard interfaces remain completely untouched.
 */
export function PublicVisualRoot({
  children,
  className = "",
}: PublicVisualRootProps) {
  const redesigned = !isProtectedCatalog(usePathname());
  return (
    <div
      className={`public-v3-root ${redesigned ? "kt-redesign" : ""} min-h-screen flex flex-col bg-[var(--kt-public-canvas)] text-[var(--kt-public-text-primary)] ${className}`}
      data-kt-version="v3"
      data-kt-theme="light"
    >
      {children}
    </div>
  );
}
