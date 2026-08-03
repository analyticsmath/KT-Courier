import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { AdministrationWorkspace } from "@/components/protected-v2/admin/AdministrationWorkspace";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

  const roleLabel = user.role === UserRole.SUPER_ADMIN ? "Super Admin" : "Administrator";
  const context = user.role === UserRole.SUPER_ADMIN ? "SUPER_ADMIN" : "ADMIN";
  const [navigation, notifications] = await Promise.all([
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context }),
    getProtectedNotificationProjection(user.id, "/admin/notifications"),
  ]);

  return (
    <EditorialOperationsShell
      context={context}
      contextLabel="Operations"
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      primaryAction={{ label: "View Orders", href: "/admin/orders" }}
      user={{ displayName: user.name ?? user.email, roleLabel }}
    >
      <AdministrationWorkspace>{children}</AdministrationWorkspace>
    </EditorialOperationsShell>
  );
}
