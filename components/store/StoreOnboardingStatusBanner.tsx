import Link from "next/link";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import type { StoreOnboardingProjection } from "@/lib/services/store-onboarding.service";

export function StoreOnboardingStatusBanner({
  onboarding,
  compact = false,
}: {
  onboarding: StoreOnboardingProjection | null;
  compact?: boolean;
}) {
  if (!onboarding) return null;

  const completeStages = onboarding.stages.filter(
    (stage) => stage.status === "COMPLETE",
  ).length;

  return (
    <section
      aria-label="Shop activation status"
      data-testid="store-onboarding-banner"
      data-shop-state={onboarding.shopState}
      className="rounded-[var(--eo-radius-panel)] border border-[var(--eo-border)] bg-[var(--eo-surface)] p-4 text-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <ProtectedStatus
              label={onboarding.shopStateLabel}
              tone={onboarding.shopStateTone}
            />
            <span className="text-xs font-semibold text-[var(--eo-text-muted)]">
              {completeStages} of {onboarding.stages.length} setup stages complete
            </span>
          </div>
          <p className="text-sm text-[var(--eo-text-secondary)]">
            {onboarding.shopStateSummary}
          </p>
          {!compact && onboarding.nextAction.actor !== "NONE" ? (
            <p className="text-xs font-medium text-[var(--eo-text-muted)]">
              Next step:{" "}
              <span className="font-semibold text-[var(--eo-text)]">
                {onboarding.nextAction.label}
              </span>{" "}
              — {onboarding.nextAction.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onboarding.nextAction.actor === "OWNER" ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white"
              href={onboarding.nextAction.href}
            >
              {onboarding.nextAction.label}
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-4 text-sm font-semibold text-[var(--eo-text)]"
            href="/store/get-started"
          >
            {onboarding.readyForCheckout ? "Shop checklist" : "Get started checklist"}
          </Link>
        </div>
      </div>
    </section>
  );
}
