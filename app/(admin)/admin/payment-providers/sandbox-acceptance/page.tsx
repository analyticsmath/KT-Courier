import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { SandboxGatewayAcceptancePanel } from "@/components/admin/SandboxGatewayAcceptancePanel";
import { resolveSandboxAcceptanceConfiguration } from "@/lib/payments/sandbox-acceptance.service";

export const metadata: Metadata = { title: "Isolated Sandbox Paystack Acceptance | KT Couriers" };
export const dynamic = "force-dynamic";

export default async function SandboxAcceptancePage() {
  await requireRole(UserRole.SUPER_ADMIN);
  const config = resolveSandboxAcceptanceConfiguration();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-2 pb-12">
      <ProtectedPageHeader
        eyebrow="Superadmin · release provenance acceptance"
        title="Isolated Paystack sandbox verification"
        description="Tests hosted Paystack test-mode checkout, webhook/Verify API, isolated sandbox ledger posting, and release-bound acceptance provenance without exposing public checkout to sandbox mode."
      />
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950">
        <strong>Isolated acceptance namespace only.</strong> Uses test-mode Paystack credentials without switching live checkout, creating customer orders, mutating store inventory, or touching live platform balances. Two-person review remains required on the Production Readiness board.
      </div>
      <SandboxGatewayAcceptancePanel eligible={config.eligible} reason={config.reason} releaseSha={config.releaseSha} />
      <div className="flex gap-4 text-sm">
        <Link href="/admin/payment-providers" className="underline underline-offset-4">Back to payment providers</Link>
        <Link href="/admin/production-readiness" className="underline underline-offset-4">Production readiness board</Link>
      </div>
    </div>
  );
}
