import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { UserRole } from "@/types/db";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(UserRole.CUSTOMER, UserRole.STORE);
  const isStore = user.role === UserRole.STORE;
  const context = isStore ? "STORE" : "CUSTOMER";
  const [profile, navigation, notifications] = await Promise.all([
    isStore ? prisma.storeProfile.findUnique({ where: { userId: user.id }, select: { storeName: true } }) : Promise.resolve(null),
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context }),
    getProtectedNotificationProjection(user.id, isStore ? "/store/notifications" : "/account/notifications"),
  ]);
  return (
    <EditorialOperationsShell
      context={context}
      contextLabel={isStore ? "Store account" : "My account"}
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      primaryAction={isStore
        ? { label: "New Delivery", href: "/store/new-delivery" }
        : { label: "Request Delivery", href: "/account/request-delivery" }}
      user={{ displayName: profile?.storeName ?? user.name ?? user.email, roleLabel: isStore ? "Business" : "Customer" }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
