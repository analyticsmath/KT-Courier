import type { Metadata } from "next";
import { PromoterSupportPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter support" };

export default async function Page() {
  await requireRole(UserRole.PROMOTER);
  return <PromoterSupportPage />;
}
