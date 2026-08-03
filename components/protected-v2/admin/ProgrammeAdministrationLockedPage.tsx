import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export function ProgrammeAdministrationLockedPage({ title, description }: { title: string; description: string }) {
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Commercial programmes" title={title} description={description} />
    <ProtectedState kind="locked" title="Programme mutations are production locked" description="No plan, campaign, funding, price, provider-success, budget, performance, attribution, or manual settlement control is rendered. This route does not invent records that the canonical authority has not released." />
  </ProtectedPageFrame>;
}
