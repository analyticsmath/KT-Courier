"use client";

import { type ReactNode } from "react";
import "./tokens.css";
import "./typography.css";

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
  return (
    <div
      className={`public-v3-root min-h-screen flex flex-col bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] ${className}`}
      data-kt-version="v3"
      data-kt-theme="light"
    >
      {children}
    </div>
  );
}
