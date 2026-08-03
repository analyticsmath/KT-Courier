import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireAuth } from "@/lib/auth/guards";
import { getProtectedNavigationForUser, isProtectedContextAvailableToRole } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";
import { UserRole } from "@/types/db";

/**
 * The required catch-all never matches `/developers`, so this shell is mounted
 * only for authenticated developer-owner routes. Developer is a presentation
 * context available to customer and store owners, not a UserRole.
 */
export default async function DeveloperPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!isProtectedContextAvailableToRole(user.role, "DEVELOPER")) redirect("/");
  const [navigation, notifications] = await Promise.all([
    getProtectedNavigationForUser({ userId: user.id, role: user.role, context: "DEVELOPER" }),
    getProtectedNotificationProjection(user.id, user.role === UserRole.STORE ? "/store/notifications" : "/account/notifications"),
  ]);
  return <EditorialOperationsShell
    context="DEVELOPER"
    contextLabel="Integration workbench"
    mobileNavigation={navigation.mobileNavigation}
    navigation={navigation.groups}
    navigationFooter={<SignOutButton />}
    notifications={notifications}
    primaryAction={{ label: "Applications", href: "/developers/applications" }}
    user={{ displayName: user.name ?? user.email, roleLabel: "Integration owner" }}
  >{children}</EditorialOperationsShell>;
}
