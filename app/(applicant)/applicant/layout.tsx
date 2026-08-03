import type { Metadata } from "next";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";
import { CandidateDossierShell } from "@/components/protected-v2/applicant";
import { requireAuth } from "@/lib/auth/guards";
export const metadata: Metadata = { ...noIndexPublicMetadata, robots: { index: false, follow: false, nocache: true } };
export default async function ApplicantLayout({ children }: { children: React.ReactNode }) { await requireAuth(); return <CandidateDossierShell>{children}</CandidateDossierShell>; }
