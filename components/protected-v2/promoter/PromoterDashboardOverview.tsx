import React from "react";
import Link from "next/link";
import {
  DashboardCanvas,
  DashboardGrid,
  DashboardCol,
  DashboardCard,
  DashboardMetricCard,
  DashboardHeader,
  DashboardIllustrationAsset,
} from "@/components/protected-v2/dashboard";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import {
  getPromoterLifecyclePresentation,
  getPromoterReferralPresentation,
  getPromoterQualificationPresentation,
  selectPromoterOperationalState,
  type PromoterAccountProjection,
  type PromoterReferralRecord,
} from "@/lib/promoter-presentation";
import {
  formatPromoterMoney,
  formatPromoterDate,
} from "@/lib/promoter-presentation/promoter-money";
import styles from "../dashboard/dashboard.module.css";

export interface PromoterDashboardOverviewProps {
  account: PromoterAccountProjection;
  referralCodes: readonly {
    id: string;
    publicReference: string;
    maskedDisplay: string;
    status: string;
    expiresAt: Date | null;
    channelName: string | null;
  }[];
  referrals: readonly PromoterReferralRecord[];
  wallet: {
    availableBalance: unknown;
    pendingBalance: unknown;
    lockedBalance: unknown;
    currency: string;
    status: string;
  } | null;
  pendingQualificationCount: number;
  activeCodeCount: number;
  heldEarnings: unknown;
  pendingWithdrawalCount: number;
  unreadNotifications: number;
}

export function PromoterDashboardOverview({
  account,
  referralCodes,
  referrals,
  wallet,
  pendingQualificationCount,
  activeCodeCount,
  heldEarnings,
  pendingWithdrawalCount,
  unreadNotifications,
}: PromoterDashboardOverviewProps) {
  const lifecycle = getPromoterLifecyclePresentation(account.status);
  const operational = selectPromoterOperationalState({
    ...account,
    pendingQualificationCount,
    hasRecentReferralActivity: referrals.length > 0,
  });
  const primaryCode = referralCodes.find((code) => code.status === "ACTIVE") ?? null;
  const recent = referrals.slice(0, 5);

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="Promoter operations"
        title={account.displayName ?? "Promoter overview"}
        description="Your referral activity, programme readiness, wallet projections, and confirmed earnings."
        actions={
          <div className="flex items-center gap-2">
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/promoter/earnings">
              Earnings ledger
            </Link>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/promoter/links">
              Referral tools
            </Link>
          </div>
        }
      />

      {/* Row 1: Programme Lifecycle (7 cols) + Financial Ledger Anchor (5 cols) */}
      <DashboardGrid ariaLabel="Programme and ledger summary">
        <DashboardCol span={7}>
          <DashboardCard
            tone="brand"
            eyebrow="Programme lifecycle"
            title={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-lg font-bold tracking-tight">Status: {lifecycle.label}</span>
                <ProtectedStatus label={lifecycle.label} tone={lifecycle.tone} />
              </div>
            }
            description="Your current promoter qualification and account standing"
            padding="normal"
          >
            <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
              <DashboardIllustrationAsset role="promoter" className="sm:max-w-[150px]" />
              <div className="flex flex-col gap-3 text-center sm:text-left">
                <p className="text-sm text-[var(--dash-ink-secondary)] leading-relaxed m-0">
                  {lifecycle.description}
                </p>
                {lifecycle.actionHref && lifecycle.actionLabel && (
                  <div>
                    <Link className={`${styles.btn} ${styles.btnPrimary}`} href={lifecycle.actionHref}>
                      {lifecycle.actionLabel}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </DashboardCard>
        </DashboardCol>

        <DashboardCol span={5}>
          <DashboardCard
            tone="dark"
            eyebrow="Financial ledger"
            title="Earning context"
            description="Authoritative balances & withdrawal rules"
            padding="normal"
          >
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Available balance</span>
                <strong className="text-[var(--dash-charcoal-text)] font-semibold">
                  {wallet ? formatPromoterMoney(wallet.availableBalance, wallet.currency) : "Not provisioned"}
                </strong>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Held earnings</span>
                <strong className="text-[var(--dash-charcoal-text)] font-semibold">
                  {formatPromoterMoney(heldEarnings)}
                </strong>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Withdrawals in progress</span>
                <strong className="text-[var(--dash-charcoal-text)] font-semibold">
                  {pendingWithdrawalCount}
                </strong>
              </div>
              <div className="flex justify-between items-center text-sm py-1.5 border-b border-[var(--dash-charcoal-line)]">
                <span className="text-[var(--dash-charcoal-muted)]">Notifications</span>
                <Link className="text-[var(--dash-brand-border)] hover:underline" href="/promoter/notifications">
                  {unreadNotifications} unread
                </Link>
              </div>
              <p className="text-[0.6875rem] text-[var(--dash-charcoal-muted)] leading-relaxed mt-1 mb-0">
                Balances are server-authoritative. New withdrawal requests are currently production locked.
              </p>
            </div>
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* KPI Metric Strip (4-card band, 2-up on mobile) */}
      <DashboardGrid ariaLabel="Promoter programme metrics">
        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Available balance"
            value={wallet ? formatPromoterMoney(wallet.availableBalance, wallet.currency) : "Not provisioned"}
            description="Current wallet projection"
            href="/promoter/wallet"
            tone="green"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Held earnings"
            value={formatPromoterMoney(heldEarnings)}
            description="Awaiting qualification release"
            href="/promoter/earnings"
            tone="surface"
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Pending qualification"
            value={pendingQualificationCount}
            description="Owned attribution records"
            href="/promoter/referrals"
            tone={pendingQualificationCount > 0 ? "orange" : "surface"}
            badge={
              pendingQualificationCount > 0 ? (
                <span className={`${styles.chip} ${styles.chipWarning}`}>Under review</span>
              ) : undefined
            }
          />
        </DashboardCol>

        <DashboardCol span={3}>
          <DashboardMetricCard
            label="Active referral codes"
            value={activeCodeCount}
            description="Current owned code records"
            href="/promoter/links"
            tone="surface"
          />
        </DashboardCol>
      </DashboardGrid>

      {/* Row 2: Three Authoritative Balance Blocks (6 cols) + Active Referral Tool (6 cols) */}
      <DashboardGrid ariaLabel="Balances and tools">
        <DashboardCol span={6}>
          <DashboardCard
            eyebrow="Financial architecture"
            title="Wallet balance ledger"
            description="Canonical promoter ledger projections without client calculation"
            action={
              <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/promoter/wallet">
                Open wallet
              </Link>
            }
            padding="normal"
          >
            {wallet ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[var(--dash-green-soft)] border border-[var(--dash-green-border)]">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-green)] block">
                    Available
                  </span>
                  <strong className="text-base font-bold text-[var(--dash-ink)] block mt-1">
                    {formatPromoterMoney(wallet.availableBalance, wallet.currency)}
                  </strong>
                  <span className="text-[0.6875rem] text-[var(--dash-muted)] mt-1 block">
                    Status: {wallet.status.toLowerCase()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--dash-orange-soft)] border border-[var(--dash-orange-border)]">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-orange)] block">
                    Pending
                  </span>
                  <strong className="text-base font-bold text-[var(--dash-ink)] block mt-1">
                    {formatPromoterMoney(wallet.pendingBalance, wallet.currency)}
                  </strong>
                  <span className="text-[0.6875rem] text-[var(--dash-muted)] mt-1 block">
                    Maturity hold
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--dash-surface-muted)] border border-[var(--dash-line)]">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)] block">
                    Locked
                  </span>
                  <strong className="text-base font-bold text-[var(--dash-ink)] block mt-1">
                    {formatPromoterMoney(wallet.lockedBalance, wallet.currency)}
                  </strong>
                  <span className="text-[0.6875rem] text-[var(--dash-muted)] mt-1 block">
                    Reserve buffer
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <p className={styles.emptyStateTitle}>Wallet not provisioned</p>
                <p className={styles.emptyStateDesc}>No promoter wallet projection currently exists for this account.</p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>

        <DashboardCol span={6}>
          <DashboardCard
            eyebrow="Attribution tool"
            title="Current referral tool"
            description="Canonical records only; this system never constructs an unconfirmed link"
            action={
              <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/promoter/links">
                View all codes
              </Link>
            }
            padding="normal"
          >
            {primaryCode ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--dash-surface-muted)] border border-[var(--dash-line)]">
                  <div>
                    <span className="text-xs font-semibold text-[var(--dash-muted)] uppercase tracking-wide block">
                      Masked code
                    </span>
                    <strong className="text-base font-bold tracking-tight text-[var(--dash-ink)]">
                      {primaryCode.maskedDisplay}
                    </strong>
                  </div>
                  <ProtectedStatus label="Active" tone="success" />
                </div>
                <div className="text-xs text-[var(--dash-muted)] leading-relaxed">
                  {primaryCode.channelName ? `Associated channel: ${primaryCode.channelName}. ` : ""}
                  Only the masked code is exposed in this privacy-safe projection. A server-confirmed share URL is not
                  provided, so share buttons are intentionally absent.
                </div>
              </div>
            ) : (
              <ProtectedState
                kind={lifecycle.restricted ? "restricted" : "empty"}
                title={lifecycle.restricted ? "Referral tools unavailable" : "No active referral code"}
                description={
                  lifecycle.restricted
                    ? "The programme state does not make referral tools available."
                    : "A referral code appears only after the canonical authority creates an owned record."
                }
              />
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>

      {/* Row 3: Attributed Referrals Activity (12 cols) */}
      <DashboardGrid ariaLabel="Attributed referrals">
        <DashboardCol span={12}>
          <DashboardCard
            eyebrow="Activity records"
            title="Qualification activity"
            description={`Operational state: ${operational.replaceAll("_", " ").toLowerCase()}. Recent owned attribution records without customer identity.`}
            action={
              recent.length > 0 ? (
                <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/promoter/referrals">
                  View all referrals
                </Link>
              ) : undefined
            }
            padding="normal"
          >
            {recent.length > 0 ? (
              <ul className={styles.recordList}>
                {recent.map((row) => {
                  const refStatus = getPromoterReferralPresentation(row.status);
                  const qualStatus = getPromoterQualificationPresentation(row.qualification?.status);
                  return (
                    <li key={row.id} className={styles.recordItem}>
                      <div className={styles.recordLeading}>
                        <Link className={styles.recordTitle} href={`/promoter/referrals/${row.publicReference}`}>
                          {row.publicReference}
                        </Link>
                        <span className={styles.recordSub}>
                          {refStatus.label} · {qualStatus.description}
                        </span>
                        <span className={styles.recordTime}>
                          Attributed {formatPromoterDate(row.attributedAt)}
                        </span>
                      </div>
                      <div className={styles.recordTrailing}>
                        <ProtectedStatus label={qualStatus.label} tone={qualStatus.tone} />
                        <Link
                          className={`${styles.btn} ${styles.btnQuiet} ${styles.btnSm}`}
                          href={`/promoter/referrals/${row.publicReference}`}
                        >
                          View record
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <RouteQueueIllustration className="h-20 w-28 mx-auto opacity-70" />
                <p className={styles.emptyStateTitle}>No attributed referrals</p>
                <p className={styles.emptyStateDesc}>
                  An attributed referral appears here only after the canonical attribution authority creates an owned record.
                </p>
              </div>
            )}
          </DashboardCard>
        </DashboardCol>
      </DashboardGrid>
    </DashboardCanvas>
  );
}
