import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { prisma } from "@/lib/db/prisma";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.DRIVER);

  const [profile, navigation, notifications] = await Promise.all([
    prisma.driverProfile.findUnique({ where: { userId: user.id } }),
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context: "DRIVER" }),
    getProtectedNotificationProjection(user.id, "/driver/notifications"),
  ]);
  const displayName = profile?.displayName ?? user.name ?? user.email;

  return (
    <EditorialOperationsShell
      context="DRIVER"
      contextLabel="Driver portal"
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      user={{ displayName, roleLabel: "Courier partner" }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
