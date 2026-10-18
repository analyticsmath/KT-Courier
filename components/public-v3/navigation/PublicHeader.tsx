"use client";
import { usePathname } from "next/navigation";
import { isProtectedCatalog } from "../redesign/route-family";
import { MarketingNavigation } from "../redesign/MarketingNavigation";

/** Shared public navigation; catalog content retains its own design boundary. */
export function PublicHeader({ className = "" }: { className?: string }) {
  const catalog = isProtectedCatalog(usePathname());
  return (
    <div
      className={`kt-redesign kt-header-boundary ${className}`}
      data-catalog={catalog}
    >
      <MarketingNavigation />
    </div>
  );
}
