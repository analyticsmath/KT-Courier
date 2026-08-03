import Link from "next/link";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export default function StoreSupportPage() {
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Help" title="Store support" description="Use the existing contact pathway for account, catalog, courier delivery, or marketplace fulfilment questions." /><OperationalPanel title="Contact support" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">A store-specific ticket projection is not available on this route. No ticket history or support status is fabricated.</p><Link className="mt-4 inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/contact">Contact KT Couriers</Link></OperationalPanel><OperationalPanel title="Before contacting support" padding="compact"><ul className="grid gap-3 text-sm text-[var(--eo-text-secondary)]"><li>For marketplace fulfilment, open the store order and review its server-confirmed stage.</li><li>For courier deliveries, open the store-created request and use its canonical detail route.</li><li>For pickup details, review the saved address in Store settings.</li></ul></OperationalPanel></ProtectedPageFrame>;
}
