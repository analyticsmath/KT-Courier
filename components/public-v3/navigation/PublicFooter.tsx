"use client";

import { EditorialFooter } from "./EditorialFooter";
import { usePathname } from "next/navigation";
import { isProtectedCatalog } from "../redesign/route-family";
import { MarketingFooter } from "../redesign/MarketingFooter";

/** One authored, accessible footer throughout the public site. */
export function PublicFooter() {
  return isProtectedCatalog(usePathname()) ? <EditorialFooter /> : <MarketingFooter />;
}
