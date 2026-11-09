import { redirect } from "next/navigation";

/** Preserve existing marketplace bookmarks without creating a second shop identity. */
export default function MarketplaceLegacyRoute() {
  // Same-origin navigation preserves the current customer session and account.
  redirect("/shop");
}
