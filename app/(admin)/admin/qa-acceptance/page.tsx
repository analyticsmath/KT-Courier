import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import {
  QaAcceptanceControlCenter,
  type QaAcceptanceDashboardView,
} from "@/components/admin/QaAcceptanceControlCenter";
import { getQaAcceptanceDashboard } from "@/lib/qa-acceptance/service";

export const metadata: Metadata = {
  title: "QA Acceptance Control Center | KT Couriers",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function AdminQaAcceptancePage() {
  await requireRole(UserRole.SUPER_ADMIN);
  const raw = await getQaAcceptanceDashboard();
  const initial = JSON.parse(JSON.stringify(raw)) as QaAcceptanceDashboardView;

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Superadmin · GitHub Issue #40 acceptance lane"
        title="Isolated QA Acceptance Control Center"
        description="Enrol authorized demonstration accounts, launch traceable end-to-end Work mode acceptance runs, inspect private /shop/qa publication and Paystack test verification, and reconcile isolated non-withdrawable ledger balances."
      />
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <strong>Isolated Non-Commercial Execution:</strong> Private storefronts under <code className="font-mono">/shop/qa</code> remain hidden from ordinary customers and search engines. Paystack charges strictly enforce <code className="font-mono">sk_test_</code> test keys and settle only into <code className="font-mono">platform-sandbox-acceptance</code> / <code className="font-mono">isQaIsolated</code> wallets.
      </div>
      <QaAcceptanceControlCenter initial={initial} />
      <div className="flex flex-wrap gap-4 text-sm font-semibold underline underline-offset-4">
        <Link href="/admin/payment-providers">Payment providers</Link>
        <Link href="/admin/payment-providers/sandbox-acceptance">Sandbox payment probe (R10)</Link>
        <Link href="/shop/qa">Open private QA storefront</Link>
      </div>
    </ProtectedPageFrame>
  );
}
