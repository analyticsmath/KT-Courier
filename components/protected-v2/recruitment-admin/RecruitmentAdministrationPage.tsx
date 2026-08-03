import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { resolveRecruitmentProductionComposition } from "@/lib/recruitment/composition-root";

export type RecruitmentAdministrationKind = "requisition" | "opening" | "application" | "interview" | "check" | "offer" | "handoff" | "fraud" | "reconciliation" | "privacy" | "retention" | "equity";

const configuration: Record<RecruitmentAdministrationKind, { title: string; description: string }> = {
  requisition: { title: "Recruitment requisitions", description: "Workforce requisition records. Approval and lifecycle controls remain server-authoritative." },
  opening: { title: "Job openings", description: "Versioned opening records. Publication and lifecycle controls remain server-authoritative." },
  application: { title: "Applicant applications", description: "Privacy-minimised application records. Candidate scoring, rankings, and fit predictions are not shown." },
  interview: { title: "Interviews", description: "Recorded interview workflow states. No invented appointment slots or score output is shown." },
  check: { title: "Background checks", description: "Restricted check workflow metadata. Evidence and protected-class inferences are withheld." },
  offer: { title: "Offers", description: "Canonical offer workflow records. Terms are not inferred or reconstructed in this presentation." },
  handoff: { title: "Onboarding handoffs", description: "Recorded handoff workflow states. Employee or driver creation is never inferred." },
  fraud: { title: "Recruitment fraud cases", description: "Restricted case metadata. Internal risk evidence and algorithms are withheld." },
  reconciliation: { title: "Recruitment reconciliation", description: "Canonical recovery cases. No force resolution is presented." },
  privacy: { title: "Recruitment privacy", description: "Privacy-notice records only. Candidate data requests remain under the canonical authority." },
  retention: { title: "Recruitment retention", description: "Retention-policy records only. No immediate purge control is presented." },
  equity: { title: "Employment equity", description: "No equity projection is rendered until a reviewed, anonymised projection is available." },
};

type SafeRecruitmentRow = { id: string; reference: string; label: string; status: string; recordedAt: string | null };

function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" ? value as Record<string, unknown> : {}; }

function safeRow(value: unknown, index: number): SafeRecruitmentRow {
  const record = object(value);
  const reference = typeof record.publicReference === "string" ? record.publicReference : `Recorded item ${index + 1}`;
  const label = [record.publicTitle, record.title, record.code, record.name, record.type, record.reason]
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0) ?? reference;
  const status = typeof record.status === "string" ? record.status : "RECORDED";
  const date = record.updatedAt ?? record.createdAt ?? record.openedAt ?? record.requestedAt;
  return { id: typeof record.id === "string" ? record.id : reference, reference, label, status, recordedAt: date instanceof Date ? date.toISOString() : null };
}

async function recordsFor(kind: RecruitmentAdministrationKind, reference?: string): Promise<unknown[]> {
  const composition = resolveRecruitmentProductionComposition();
  if (kind === "equity") return [];
  const service = composition.services;
  if (kind === "opening") {
    const model = composition.database.recruitmentOpening;
    return reference ? [await model.findUnique({ where: { publicReference: reference } })].filter(Boolean) : await model.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  }
  const methods: Record<Exclude<RecruitmentAdministrationKind, "opening" | "equity">, { list: () => Promise<unknown[]>; detail?: (value: string) => Promise<unknown> }> = {
    requisition: { list: () => service.requisitions.listRequisitions(), detail: (value) => service.requisitions.getRequisition(value) },
    application: { list: () => service.applications.listApplications(), detail: (value) => service.applications.getApplicationByReference(value) },
    interview: { list: () => service.interviews.listInterviews(), detail: (value) => service.interviews.getInterviewByReference(value) },
    check: { list: () => service.checks.listCheckCases(), detail: (value) => service.checks.getCheckCaseByReference(value) },
    offer: { list: () => service.offers.listOffers(), detail: (value) => service.offers.getOfferByReference(value) },
    handoff: { list: () => service.handoffs.listHandoffs(), detail: (value) => service.handoffs.getHandoffByReference(value) },
    fraud: { list: () => service.fraud.listFraudCases(), detail: (value) => service.fraud.getFraudCaseByReference(value) },
    reconciliation: { list: () => service.reconciliation.listReconciliationCases(), detail: (value) => service.reconciliation.getReconciliationCaseByReference(value) },
    privacy: { list: () => service.privacyRetention.listPrivacyNotices() },
    retention: { list: () => service.privacyRetention.listRetentionPolicies() },
  };
  const method = methods[kind];
  return reference && method.detail ? [await method.detail(reference)].filter(Boolean) : method.list();
}

export async function RecruitmentAdministrationPage({ kind, reference }: { kind: RecruitmentAdministrationKind; reference?: string }) {
  const config = configuration[kind];
  const composition = resolveRecruitmentProductionComposition();
  if (kind === "equity") return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Recruitment administration" title={config.title} description={config.description} /><ProtectedState kind="unavailable" title="Anonymised equity projection unavailable" description="This route does not render a raw report or individual declaration while a reviewed anonymous projection is unavailable." /></ProtectedPageFrame>;
  let rows: SafeRecruitmentRow[] = [];
  let unavailable = false;
  try { rows = (await recordsFor(kind, reference)).map(safeRow); } catch { unavailable = true; }
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Recruitment administration" title={reference ?? config.title} description={config.description} />
    {composition.status === "LOCKED" ? <ProtectedState kind="locked" title="Recruitment mutations are production locked" description="Readable canonical records remain available. Creation, review, approval, publication, interview, check, offer, and handoff controls are intentionally omitted." /> : null}
    {unavailable ? <ProtectedState kind="unavailable" title="Protected projection unavailable" description="The existing authority could not provide a safe record projection. No raw API payload or fallback record is rendered." /> : <OperationalPanel title={reference ? "Canonical record" : "Canonical records"} description="Only safe record identifiers, workflow state, and timestamps are rendered."><EditorialTable caption={`${config.title} records`} mobileMode="stack" rows={rows} emptyState={<ProtectedState kind="empty" title="No records available" description="No canonical record matches this view." />} columns={[
      { id: "record", header: "Record", priority: "primary", cell: (row) => <div><strong>{row.label}</strong><p className="text-sm text-[var(--eo-muted)]">{row.reference}</p></div> },
      { id: "state", header: "State", priority: "secondary", cell: (row) => { const state = presentR21Status(row.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
      { id: "recorded", header: "Recorded", priority: "optional", cell: (row) => row.recordedAt ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.recordedAt)) : "Not recorded" },
    ]} /></OperationalPanel>}
  </ProtectedPageFrame>;
}

export function RecruitmentAdministrationOverview() {
  const routes = [
    ["Requisitions", "/admin/recruitment/requisitions"], ["Openings", "/admin/recruitment/openings"], ["Applications", "/admin/recruitment/applications"], ["Interviews", "/admin/recruitment/interviews"], ["Checks", "/admin/recruitment/checks"], ["Offers", "/admin/recruitment/offers"], ["Handoffs", "/admin/recruitment/handoffs"], ["Reconciliation", "/admin/recruitment/reconciliation"],
  ] as const;
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Recruitment administration" title="Recruitment operations" description="A protected navigation surface with no dashboard metrics, scores, rankings, or invented scheduling data." /><OperationalPanel title="Canonical work areas" description="Each route performs its own server-side permission check before reading a safe projection."><ul aria-label="Recruitment administration work areas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{routes.map(([label, href]) => <li key={href}><Link className="block rounded border border-[var(--eo-border)] p-4 font-semibold hover:underline" href={href}>{label}</Link></li>)}</ul></OperationalPanel></ProtectedPageFrame>;
}
