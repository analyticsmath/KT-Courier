import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.CUSTOMER);
  const [navigation, notifications] = await Promise.all([
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context: "CUSTOMER" }),
    getProtectedNotificationProjection(user.id, "/account/notifications"),
  ]);

  return (
    <EditorialOperationsShell
      context="CUSTOMER"
      contextLabel="My account"
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      primaryAction={{ label: "Request Delivery", href: "/account/request-delivery" }}
      user={{ displayName: user.name ?? user.email, roleLabel: "Customer" }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
