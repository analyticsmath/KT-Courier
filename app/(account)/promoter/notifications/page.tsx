import type { Metadata } from "next";
import { PromoterNotificationsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { getPromoterNotifications } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter notifications" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  return <PromoterNotificationsPage notifications={await getPromoterNotifications(user.id)} />;
}
