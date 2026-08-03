import { SignOutButton } from "@/components/auth/SignOutButton";
import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireRole } from "@/lib/auth/guards";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";
import { UserRole } from "@/types/db";

/**
 * R17's verified protected boundary. The promoter tree has no parent account
 * layout, so this nested layout adds the R13 shell without changing any path.
 */
export default async function PromoterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.PROMOTER);
  const [navigation, notifications] = await Promise.all([
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context: "PROMOTER" }),
    getProtectedNotificationProjection(user.id, "/promoter/notifications"),
  ]);

  return <EditorialOperationsShell
    context="PROMOTER"
    contextLabel="Promoter programme"
    mobileNavigation={navigation.mobileNavigation}
    navigation={navigation.groups}
    navigationFooter={<SignOutButton />}
    notifications={notifications}
    primaryAction={{ label: "Referral tools", href: "/promoter/links" }}
    user={{ displayName: user.name ?? user.email, roleLabel: "Promoter" }}
  >{children}</EditorialOperationsShell>;
}
