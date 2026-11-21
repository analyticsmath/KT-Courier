import Link from "next/link";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";

export type StoreRepairGateItem = {
  key: string;
  category: "IDENTITY" | "COLLECTION" | "SETTLEMENT" | "CATALOG" | "POLICY" | "CERTIFICATION";
  title: string;
  ready: boolean;
  explanation: string;
  actionHref?: string;
  actionLabel?: string;
};

export type StoreRepairCockpitProps = {
  storeId: string;
  storeName: string;
  isPubliclyVisible: boolean;
  blockers: string[];
  gates: StoreRepairGateItem[];
};

export function StoreRepairCockpit({
  storeName,
  isPubliclyVisible,
  blockers,
  gates,
}: StoreRepairCockpitProps) {
  const readyCount = gates.filter((g) => g.ready).length;
  const totalCount = gates.length;

  return (
    <OperationalPanel
      title="Store Publication & Checkout Repair Cockpit"
      description="Real-time SQL publication diagnosis. Public storefront listing and customer checkout require all 6 operational records to be genuinely configured and independently certified. Software enforcement requires complete per-store data."
      action={
        <div className="flex items-center gap-2">
          <ProtectedStatus
            label={isPubliclyVisible ? "PUBLICLY READY" : `${blockers.length} REPAIR ACTIONS NEEDED`}
            tone={isPubliclyVisible ? "success" : "warning"}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border p-4 bg-[var(--kt-bg-subtle,#f9fafb)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                Publication Readiness Score: {readyCount} of {totalCount} Gates Satisfied
              </p>
              <p className="text-xs text-[var(--kt-text-muted,#6b7280)] mt-0.5">
                {isPubliclyVisible
                  ? `${storeName} satisfies all SQL publication constraints and is visible to public customers.`
                  : `${storeName} is hidden from public browse/checkout to protect customers and merchant legal compliance.`}
              </p>
            </div>
            {!isPubliclyVisible && (
              <span className="text-xs font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                sql-store-publication: BLOCKED
              </span>
            )}
          </div>
        </div>

        {blockers.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-4">
            <h3 className="text-sm font-semibold text-amber-900 mb-2">
              Active Publication Blockers ({blockers.length})
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
              {blockers.map((blocker, index) => (
                <li key={index}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gates.map((gate) => (
            <div
              key={gate.key}
              className={`rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                gate.ready
                  ? "border-emerald-200 bg-emerald-50/20"
                  : "border-amber-200 bg-amber-50/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-[var(--kt-text-muted,#6b7280)] uppercase tracking-wide">
                    {gate.category}
                  </span>
                  <ProtectedStatus
                    label={gate.ready ? "READY" : "ACTION REQUIRED"}
                    tone={gate.ready ? "success" : "warning"}
                  />
                </div>
                <h4 className="text-sm font-semibold mb-1">{gate.title}</h4>
                <p className="text-xs text-[var(--kt-text-muted,#6b7280)] leading-relaxed">
                  {gate.explanation}
                </p>
              </div>

              {gate.actionHref && gate.actionLabel && (
                <div className="mt-3 pt-3 border-t border-[var(--kt-border-subtle,#e5e7eb)]">
                  <Link
                    href={gate.actionHref}
                    className="inline-flex items-center text-xs font-semibold text-[var(--kt-brand-primary,#2563eb)] hover:underline"
                  >
                    {gate.actionLabel} &rarr;
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </OperationalPanel>
  );
}
