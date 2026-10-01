import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import {
  membershipAllows,
  type StoreModule,
} from "@/lib/client-platform/store-permissions";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
const sections: ReadonlyArray<[StoreModule, string, string]> = [
  ["orders", "Orders", "/store/orders"],
  ["deliveries", "New delivery", "/store/new-delivery"],
  ["products", "Products", "/store/catalog"],
  ["marketing", "Marketing", "/store/advertising"],
  ["finance", "Earnings", "/store/earnings"],
  ["reviews", "Reviews", "/store/reviews"],
  ["chat", "Support", "/store/support"],
  ["settings", "Business settings", "/store/profile"],
];
export default async function Page() {
  const a = await requireBusinessPage("/store/workspace");
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Business workspace"
        title={a.store.name}
        description={`Signed in as ${a.user.name ?? a.user.email}. Your account has access to the modules assigned by the business owner.`}
      />
      <nav className="grid gap-4 sm:grid-cols-2">
        {sections
          .filter(([m]) => a.owner || membershipAllows(a.permissions, m))
          .map(([, label, href]) => (
            <Link
              key={href}
              href={href}
              className="border border-[var(--eo-border)] rounded-[var(--eo-radius-panel)] p-6 font-semibold hover:bg-[var(--eo-surface-subtle)]"
            >
              {label}
            </Link>
          ))}
      </nav>
    </ProtectedPageFrame>
  );
}
