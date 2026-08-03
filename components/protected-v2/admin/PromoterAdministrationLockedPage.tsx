import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export function PromoterAdministrationLockedPage({ title, detail = false }: { title: string; detail?: boolean }) {
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Promoter administration" title={title} description={detail ? "A protected detail route for a canonical promoter administration record." : "A protected promoter administration route."} />
    <ProtectedState kind="locked" title="Promoter administration is production locked" description="The existing authority does not currently release readable promoter administration records. No customer identity, attribution evidence, qualification logic, fraud evidence, payout detail, or mutation control is rendered." />
  </ProtectedPageFrame>;
}
