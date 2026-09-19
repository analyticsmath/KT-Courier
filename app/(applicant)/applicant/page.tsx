import React from "react";
import Link from "next/link";
import {
  DashboardCanvas,
  DashboardGrid,
  DashboardCol,
  DashboardCard,
  DashboardHeader,
  DashboardIllustrationAsset,
} from "@/components/protected-v2/dashboard";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { getApplicantApplications } from "@/lib/applicant-presentation/applicant-data";
import { getApplicantStatus } from "@/lib/applicant-presentation/applicant-status";
import styles from "@/components/protected-v2/dashboard/dashboard.module.css";

type PhaseKey = "SUBMISSION" | "REVIEW" | "ASSESSMENT" | "OUTCOME" | "CLOSED";

function getPhaseKey(status?: string | null): PhaseKey {
  if (!status || status === "DRAFT" || status === "SUBMITTED") return "SUBMISSION";
  if (
    [
      "COMPLETENESS_REVIEW",
      "ELIGIBILITY_REVIEW",
      "HUMAN_REVIEW",
      "OFFER_APPROVAL",
    ].includes(status)
  )
    return "REVIEW";
  if (["INTERVIEW", "CONDITIONAL_CHECKS"].includes(status)) return "ASSESSMENT";
  if (["OFFERED", "OFFER_ACCEPTED", "ONBOARDING_HANDOFF", "COMPLETED"].includes(status))
    return "OUTCOME";
  return "CLOSED";
}

const PHASES: readonly { key: PhaseKey; label: string; step: number }[] = [
  { key: "SUBMISSION", label: "1. Submission", step: 1 },
  { key: "REVIEW", label: "2. Review", step: 2 },
  { key: "ASSESSMENT", label: "3. Assessment", step: 3 },
  { key: "OUTCOME", label: "4. Decision", step: 4 },
];

export default async function ApplicantPage() {
  const apps = await getApplicantApplications();
  const current = apps[0];
  const status = current ? getApplicantStatus(current.status) : null;
  const currentPhase = current ? getPhaseKey(current.status) : null;

  return (
    <DashboardCanvas>
      <DashboardHeader
        eyebrow="Your next chapter"
        title="Candidate dossier"
        description="Your applications, progress tracking, and next available steps in one private place."
        actions={
          <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/careers">
            View careers
          </Link>
        }
      />

      {!current ? (
        <DashboardGrid ariaLabel="Candidate status">
          <DashboardCol span={12}>
            <DashboardCard tone="surface" padding="spacious">
              <div className="flex flex-col items-center justify-center text-center py-6 gap-4">
                <DashboardIllustrationAsset role="applicant" className="max-w-[200px]" />
                <div className="flex flex-col gap-2 max-w-md">
                  <h2 className="text-xl font-bold tracking-tight text-[var(--dash-ink)] m-0">
                    Your journey starts with an opening
                  </h2>
                  <p className="text-sm text-[var(--dash-muted)] m-0">
                    Find a role that fits you. Your application progress and private dossier will appear here once you
                    apply.
                  </p>
                </div>
                <div className="pt-2">
                  <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/careers">
                    View published careers
                  </Link>
                </div>
              </div>
            </DashboardCard>
          </DashboardCol>
        </DashboardGrid>
      ) : (
        <>
          {/* Main Application Progress Console (8 cols) + Tools (4 cols) */}
          <DashboardGrid ariaLabel="Application progress">
            <DashboardCol span={8}>
              <DashboardCard
                tone="brand"
                eyebrow="Active application"
                title={
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xl font-bold tracking-tight">
                      {current.openingVersion?.publicTitle ?? "Application"}
                    </span>
                    {status && <ProtectedStatus label={status.label} tone={status.tone} />}
                  </div>
                }
                description={
                  current.updatedAt
                    ? `Updated ${new Intl.DateTimeFormat("en-ZA", {
                        dateStyle: "medium",
                        timeZone: "Africa/Johannesburg",
                      }).format(current.updatedAt)}`
                    : undefined
                }
                action={
                  <Link
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    href={`/applicant/applications/${current.publicReference}`}
                  >
                    Open application
                  </Link>
                }
                padding="spacious"
              >
                <div className="flex flex-col gap-5 pt-2">
                  <p className="text-sm text-[var(--dash-ink-secondary)] leading-relaxed m-0">
                    {status?.explanation}
                  </p>

                  {/* Phase Tracker: Highlights current phase truthfully without fake past checkmarks */}
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-[var(--dash-surface)] border border-[var(--dash-line)]">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--dash-muted)]">
                      Hiring journey phase
                    </span>

                    {currentPhase === "CLOSED" ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--dash-muted)]">
                        <span className={`${styles.chip} ${styles.chipNeutral}`}>Closed</span>
                        <span>This application is no longer progressing through active stages.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {PHASES.map((p) => {
                          const isCurrent = currentPhase === p.key;
                          return (
                            <div
                              key={p.key}
                              className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col gap-1 ${
                                isCurrent
                                  ? "bg-[var(--dash-green-soft)] border-[var(--dash-green-border)] text-[var(--dash-green)]"
                                  : "bg-[var(--dash-surface-muted)] border-[var(--dash-line)] text-[var(--dash-muted)]"
                              }`}
                            >
                              <span>{p.label}</span>
                              {isCurrent && (
                                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--dash-green)]">
                                  Current stage
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-[var(--dash-muted)]">
                    Reference: <strong className="text-[var(--dash-ink)] font-mono">{current.publicReference}</strong>
                  </div>
                </div>
              </DashboardCard>
            </DashboardCol>

            <DashboardCol span={4}>
              <DashboardCard
                tone="dark"
                eyebrow="Candidate tools"
                title="Your workspace"
                description="Manage your profile & records"
                padding="normal"
              >
                <div className="flex flex-col gap-2.5 pt-1">
                  <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/applicant/applications">
                    📄 All applications
                  </Link>
                  <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/applicant/profile">
                    👤 Candidate profile
                  </Link>
                  <Link className={`${styles.btn} ${styles.btnDark} justify-start`} href="/applicant/privacy">
                    🔒 Privacy & data rights
                  </Link>
                </div>
              </DashboardCard>
            </DashboardCol>
          </DashboardGrid>

          {/* Context Card with Repo-Owned Illustration (12 cols) */}
          <DashboardGrid ariaLabel="Applicant resources">
            <DashboardCol span={12}>
              <DashboardCard
                eyebrow="Application support"
                title="Preparing for what's next"
                description="Information on our interview, vehicle verification, and onboarding process"
                padding="normal"
              >
                <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                  <DashboardIllustrationAsset role="applicant" className="sm:max-w-[160px]" />
                  <div className="flex flex-col gap-2 max-w-xl">
                    <p className="text-sm text-[var(--dash-ink-secondary)] m-0 leading-relaxed">
                      Our talent operations team reviews candidate submissions in sequence. When your application moves
                      to the assessment or interview stage, notification records and instructions will appear in this dossier.
                    </p>
                    <div className="pt-2">
                      <Link className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} href="/careers">
                        Explore other opportunities
                      </Link>
                    </div>
                  </div>
                </div>
              </DashboardCard>
            </DashboardCol>
          </DashboardGrid>
        </>
      )}
    </DashboardCanvas>
  );
}
