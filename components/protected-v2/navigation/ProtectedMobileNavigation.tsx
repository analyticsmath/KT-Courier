"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ProtectedIcon } from "@/components/protected-v2/icons/ProtectedIcon";
import { ProtectedDrawer } from "@/components/protected-v2/overlays/ProtectedDrawer";
import { EditorialTopbar } from "@/components/protected-v2/shell/EditorialTopbar";
import { isProtectedNavigationItemCurrent, ProtectedNavigationLinks } from "./ProtectedNavigation";
import type { ProtectedApplicationContext, ProtectedNavigationGroup, ProtectedNavigationItem } from "./types";

type ProtectedMobileNavigationProps = {
  context: ProtectedApplicationContext;
  contextLabel: string;
  groups: readonly ProtectedNavigationGroup[];
  mobileNavigation: readonly ProtectedNavigationItem[];
  user: { displayName: string; roleLabel: string; avatarUrl?: string | null };
  notifications?: { unreadCount: number; href: string };
  profileHref?: string;
  primaryAction?: { label: string; href: string };
};

const bottomNavigationContexts: readonly ProtectedApplicationContext[] = ["CUSTOMER", "DRIVER"];

export function ProtectedMobileNavigation({
  context,
  contextLabel,
  groups,
  mobileNavigation,
  user,
  notifications,
  profileHref,
  primaryAction,
}: ProtectedMobileNavigationProps) {
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const useBottomNavigation = bottomNavigationContexts.includes(context);
  const bottomItems = mobileNavigation.slice(0, 4);
  const bottomItemIds = new Set(bottomItems.map((item) => item.id));
  const drawerGroups = useBottomNavigation
    ? groups.map((group) => ({ ...group, items: group.items.filter((item) => !bottomItemIds.has(item.id)) })).filter((group) => group.items.length > 0)
    : groups;
  const moreCurrent = drawerGroups.some((group) => group.items.some((item) => isProtectedNavigationItemCurrent(item, pathname)));

  return (
    <>
      <EditorialTopbar
        contextLabel={contextLabel}
        notifications={notifications}
        onNavigationOpen={() => setNavigationOpen(true)}
        primaryAction={primaryAction}
        profileHref={profileHref}
        user={user}
      />
      {useBottomNavigation && bottomItems.length > 0 ? (
        <nav aria-label={`${contextLabel} mobile navigation`} className="eo-bottom-navigation">
          {bottomItems.map((item) => {
            const current = isProtectedNavigationItemCurrent(item, pathname);
            return (
              <Link aria-current={current ? "page" : undefined} className={cn("eo-bottom-navigation__item", current && "is-current")} href={item.href} key={item.id}>
                <ProtectedIcon className="eo-bottom-navigation__icon" name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {drawerGroups.length > 0 ? (
            <button aria-current={moreCurrent ? "page" : undefined} className={cn("eo-bottom-navigation__item", moreCurrent && "is-current")} onClick={() => setNavigationOpen(true)} type="button">
              <svg aria-hidden="true" className="eo-bottom-navigation__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
              <span>More</span>
            </button>
          ) : null}
        </nav>
      ) : null}
      <ProtectedDrawer
        fullScreen
        onClose={() => setNavigationOpen(false)}
        open={navigationOpen}
        title={`${contextLabel} navigation`}
      >
        <nav aria-label={`${contextLabel} full navigation`} className="eo-mobile-navigation-sheet">
          <ProtectedNavigationLinks groups={drawerGroups} onNavigate={() => setNavigationOpen(false)} />
        </nav>
      </ProtectedDrawer>
    </>
  );
}
