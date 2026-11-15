import Link from "next/link";
import { ProtectedStatus, type ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";
import {
  MetricTile,
  OperationalPanel,
} from "@/components/protected-v2/surfaces/OperationalPanel";
import type {
  StoreOnboardingProjection,
  StoreOnboardingShopState,
  StoreOnboardingStageStatus,
} from "@/lib/services/store-onboarding.service";

const STATE_SEQUENCE: ReadonlyArray<{
  key: StoreOnboardingShopState;
  label: string;
}> = [
  { key: "ACCOUNT_APPLICATION", label: "Account application" },
  { key: "ACCOUNT_APPROVED", label: "Account approved" },
  { key: "GETTING_SHOP_READY", label: "Getting shop ready" },
  { key: "SHOP_LIVE", label: "Shop LIVE" },
  { key: "SHOP_PAUSED", label: "Shop paused" },
];

function stageStatusMeta(status: StoreOnboardingStageStatus): {
  label: string;
  tone: ProtectedStatusTone;
} {
  switch (status) {
    case "COMPLETE":
      return { label: "Complete", tone: "success" };
    case "IN_PROGRESS":
      return { label: "In progress", tone: "information" };
    case "WAITING_ADMIN":
      return { label: "Waiting on admin", tone: "warning" };
    default:
      return { label: "Action needed", tone: "danger" };
  }
}

export function StoreOnboardingCockpit({
  onboarding,
}: {
  onboarding: StoreOnboardingProjection;
}) {
  return (
    <div className="space-y-6">
      <OperationalPanel
        title="Current shop lifecycle state"
        description={onboarding.shopStateSummary}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ProtectedStatus
              label={onboarding.shopStateLabel}
              tone={onboarding.shopStateTone}
            />
            {onboarding.nextAction.actor === "OWNER" ? (
              <Link
                className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white"
                href={onboarding.nextAction.href}
              >
                {onboarding.nextAction.label}
              </Link>
            ) : (
              <Link
                className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-4 text-sm font-semibold text-[var(--eo-text)]"
                href={onboarding.nextAction.href}
              >
                {onboarding.nextAction.label}
              </Link>
            )}
          </div>

          <ol
            aria-label="Shop lifecycle stages"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          >
            {STATE_SEQUENCE.map((item, idx) => {
              const current = item.key === onboarding.shopState;
              return (
                <li
                  key={item.key}
                  aria-current={current ? "step" : undefined}
                  className={
                    current
                      ? "rounded-[var(--eo-radius-control)] border-2 border-[var(--eo-signal)] bg-[var(--eo-surface)] p-3 text-sm font-semibold text-[var(--eo-text)]"
                      : "rounded-[var(--eo-radius-control)] border border-[var(--eo-line-soft)] p-3 text-xs text-[var(--eo-text-muted)]"
                  }
                >
                  <span className="block text-[11px] uppercase tracking-wide">
                    State {idx + 1}
                  </span>
                  <span className="mt-1 block">{item.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </OperationalPanel>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Shop readiness metrics"
      >
        <MetricTile
          tone="blue"
          label="Stock locations"
          value={onboarding.metrics.activeInventoryLocations}
          description="Active inventory locations"
        />
        <MetricTile
          label="Products drafted"
          value={onboarding.metrics.draftOrActiveProducts}
          description={`${onboarding.metrics.approvedProducts} moderation approved`}
        />
        <MetricTile
          tone="citrus"
          label="Sellable offers"
          value={onboarding.metrics.sellableOffers}
          description="Published with price, stock & packaging"
        />
        <MetricTile
          tone={onboarding.metrics.liveStorefrontProducts > 0 ? "blue" : "coral"}
          label="Public storefront"
          value={onboarding.metrics.liveStorefrontProducts}
          description={
            onboarding.readyForCheckout
              ? "Live for customer checkout"
              : "Awaiting full certification"
          }
        />
      </div>

      {(onboarding.ownerActionBlockers.length > 0 ||
        onboarding.adminReviewBlockers.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <OperationalPanel
            accent="coral"
            title="Your remaining owner actions"
            description="Complete these items yourself — no support request is needed."
            padding="compact"
          >
            {onboarding.ownerActionBlockers.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--eo-text-secondary)]">
                {onboarding.ownerActionBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-[var(--eo-text)]" role="status">
                All owner-controlled onboarding prerequisites are currently in place.
              </p>
            )}
          </OperationalPanel>

          <OperationalPanel
            accent="blue"
            title="KT Couriers independent approvals"
            description="These safeguards are completed by KT Couriers administrators."
            padding="compact"
          >
            {onboarding.adminReviewBlockers.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--eo-text-secondary)]">
                {onboarding.adminReviewBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-medium text-[var(--eo-text)]" role="status">
                No outstanding administrator approvals remain.
              </p>
            )}
          </OperationalPanel>
        </div>
      )}

      <OperationalPanel
        title="Four-stage launch checklist"
        description="Complete each stage in any order while awaiting administrator approval."
      >
        <div className="space-y-4">
          {onboarding.stages.map((stage) => {
            const meta = stageStatusMeta(stage.status);
            return (
              <article
                key={stage.id}
                aria-label={`Stage ${stage.order}: ${stage.title}`}
                className="rounded-[var(--eo-radius-panel)] border border-[var(--eo-border)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[var(--eo-text-muted)]">
                        Stage {stage.order}
                      </span>
                      <ProtectedStatus label={meta.label} tone={meta.tone} />
                    </div>
                    <h3 className="text-base font-semibold text-[var(--eo-text)]">
                      {stage.title}
                    </h3>
                    <p className="text-sm text-[var(--eo-text-secondary)]">
                      {stage.summary}
                    </p>
                  </div>
                  <Link
                    className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-4 text-sm font-semibold text-[var(--eo-text)]"
                    href={stage.actionHref}
                  >
                    {stage.actionLabel}
                  </Link>
                </div>

                <dl className="mt-4 grid gap-3 border-t border-[var(--eo-line-soft)] pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {stage.items.map((item) => (
                    <div key={item.label}>
                      <dt className="font-semibold text-[var(--eo-text)]">
                        {item.done ? "Ready: " : "Pending: "}
                        {item.label}
                      </dt>
                      <dd className="mt-0.5 text-xs text-[var(--eo-text-muted)]">
                        {item.detail}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
      </OperationalPanel>
    </div>
  );
}
