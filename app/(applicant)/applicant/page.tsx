import Link from "next/link";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { IllustrationFrame } from "@/components/protected-v2/illustrations/IllustrationFrame";
import { getApplicantApplications } from "@/lib/applicant-presentation/applicant-data";
import { getApplicantStatus } from "@/lib/applicant-presentation/applicant-status";

export default async function ApplicantPage() {
  const apps = await getApplicantApplications();
  const current = apps[0];
  const status = current ? getApplicantStatus(current.status) : null;
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Your next chapter" title="Candidate dossier" description="Your applications, progress, and next available steps in one private place." />
    {!current ? <ProtectedState kind="empty" title="Your journey starts with an opening" description="Find a role that fits you. Your application will appear here after you apply." illustration={<IllustrationFrame role="applicant" />} action={<Link className="eo-button eo-button--primary" href="/careers">View published careers</Link>} /> : <OperationalPanel className="eo-feature-card" title="Current application" padding="spacious" action={<IllustrationFrame role="applicant" />}>
      <h2 className="text-2xl font-semibold">{current.openingVersion?.publicTitle ?? "Application"}</h2>
      {status ? <ProtectedStatus label={status.label} tone={status.tone} /> : null}
      <p className="my-4 text-[var(--eo-text-secondary)]">{status?.explanation}</p>
      <p className="mb-4 text-sm text-[var(--eo-text-muted)]">Updated {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" }).format(current.updatedAt)}</p>
      <Link className="eo-button eo-button--primary" href={`/applicant/applications/${current.publicReference}`}>Open application</Link>
    </OperationalPanel>}
    <OperationalPanel title="Your application workspace" tone="subtle"><div className="eo-quick-links"><Link className="eo-button" href="/applicant/applications">All applications</Link><Link className="eo-button" href="/applicant/profile">Profile</Link><Link className="eo-button" href="/applicant/privacy">Privacy and your data</Link></div></OperationalPanel>
  </ProtectedPageFrame>;
}
