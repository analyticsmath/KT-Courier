import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { readHomeBannerState } from "@/lib/super-admin/home-banner";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { HomeBannerEditor } from "@/components/admin/HomeBannerEditor";
export const dynamic="force-dynamic";
export default async function SuperAdminBanners(){
 const actor=await requireRole(UserRole.SUPER_ADMIN);
 return <ProtectedPageFrame><ProtectedPageHeader title="Homepage banners" description="Prepare accessible editorial banners, schedule publication, require independent review, and disable them immediately."/><HomeBannerEditor state={await readHomeBannerState()} actorId={actor.id}/></ProtectedPageFrame>;
}
