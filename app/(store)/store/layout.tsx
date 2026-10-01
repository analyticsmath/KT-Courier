import { redirect } from "next/navigation";
import { storeAccess } from "@/lib/client-platform/store-access";
import {
  membershipAllows,
  moduleForStorePath,
} from "@/lib/client-platform/store-permissions";
import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import { requireAuth } from "@/lib/auth/guards";
import { UserRole } from "@/types/db";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { prisma } from "@/lib/db/prisma";
import { getProtectedNavigationForUser } from "@/lib/protected-navigation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  let access;
  try {
    access = await storeAccess(user.id);
  } catch {
    redirect("/account");
  }

  const [profile, navigation, notifications] = await Promise.all([
    prisma.storeProfile.findUnique({
      where: { userId: access.store.ownerUserId ?? user.id },
    }),
    getProtectedNavigationForUser({
      userId: user.id,
      role: UserRole.STORE,
      context: "STORE",
    }),
    getProtectedNotificationProjection(user.id, "/store/notifications"),
  ]);
  const displayName = access.owner
    ? (profile?.storeName ?? user.name ?? user.email)
    : (user.name ?? user.email);
  if (!access.owner) {
    const visible = (href: string) =>
      href === "/store/workspace" ||
      membershipAllows(access.permissions, moduleForStorePath(href));
    navigation.groups = navigation.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => visible(i.href)) }))
      .filter((g) => g.items.length);
    navigation.mobileNavigation = navigation.mobileNavigation.filter((i) =>
      visible(i.href),
    );
  }

  return (
    <EditorialOperationsShell
      context="STORE"
      contextLabel="Store account"
      mobileNavigation={navigation.mobileNavigation}
      navigation={navigation.groups}
      navigationFooter={<SignOutButton />}
      notifications={notifications}
      primaryAction={
        access.owner || membershipAllows(access.permissions, "deliveries")
          ? { label: "New Delivery", href: "/store/new-delivery" }
          : undefined
      }
      user={{
        displayName,
        roleLabel: access.owner ? "Business owner" : "Business employee",
      }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
