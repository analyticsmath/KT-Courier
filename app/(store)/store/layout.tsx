import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { prisma } from "@/lib/db/prisma";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.STORE);

  const [profile, navigation, notifications] = await Promise.all([
    prisma.storeProfile.findUnique({ where: { userId: user.id } }),
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context: "STORE" }),
    getProtectedNotificationProjection(user.id, "/store/notifications"),
  ]);
  const displayName = profile?.storeName ?? user.name ?? user.email;

  return (
    <EditorialOperationsShell
      context="STORE"
      contextLabel="Store account"
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      primaryAction={{ label: "New Delivery", href: "/store/new-delivery" }}
      user={{ displayName, roleLabel: "Business" }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
