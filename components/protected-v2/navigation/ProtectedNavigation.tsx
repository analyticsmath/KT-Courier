"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ProtectedIcon } from "@/components/protected-v2/icons/ProtectedIcon";
import type { ProtectedNavigationGroup, ProtectedNavigationItem } from "./types";

type ProtectedNavigationLinksProps = {
  groups: readonly ProtectedNavigationGroup[];
  onNavigate?: () => void;
  compact?: boolean;
};

export function isProtectedNavigationItemCurrent(item: ProtectedNavigationItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProtectedNavigationLinks({ groups, onNavigate, compact = false }: ProtectedNavigationLinksProps) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(() => new Set());

  return (
    <div className="eo-navigation-links">
      {groups.map((group) => {
        const isOpen = !closedGroups.has(group.id);
        return (
          <section className="eo-navigation-group" key={group.id}>
            <button
              aria-controls={`eo-nav-group-${group.id}`}
              aria-expanded={isOpen}
              className="eo-navigation-group__toggle"
              onClick={() => {
                setClosedGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                });
              }}
              type="button"
            >
              <span className="eo-navigation-group__label">{group.label}</span>
              <svg aria-hidden="true" className={cn("eo-navigation-group__chevron", !isOpen && "-rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="m8 10 4 4 4-4" /></svg>
            </button>
            {isOpen ? (
              <ul className="eo-navigation-group__items" id={`eo-nav-group-${group.id}`}>
                {group.items.map((item) => {
                  const current = isProtectedNavigationItemCurrent(item, pathname);
                  return (
                    <li key={item.id}>
                      <Link
                        aria-current={current ? "page" : undefined}
                        aria-label={compact ? item.label : undefined}
                        className={cn("eo-navigation-link", current && "is-current")}
                        href={item.href}
                        onClick={onNavigate}
                        title={compact ? item.label : undefined}
                      >
                        <ProtectedIcon className="eo-navigation-link__icon" name={item.icon} />
                        <span className="eo-navigation-link__label">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

type ProtectedDesktopNavigationProps = {
  contextLabel: string;
  groups: readonly ProtectedNavigationGroup[];
  user: { displayName: string; roleLabel: string; avatarUrl?: string | null };
  footer?: React.ReactNode;
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KT";
}

export function ProtectedDesktopNavigation({ contextLabel, groups, user, footer }: ProtectedDesktopNavigationProps) {
  const [railExpanded, setRailExpanded] = useState(false);

  return (
    <aside aria-label={`${contextLabel} primary navigation`} className={cn("eo-desktop-navigation", railExpanded && "is-rail-expanded")}>
      <div className="eo-desktop-navigation__brand">
        <Link aria-label="KT Couriers home" className="eo-brand" href="/">
          <span aria-hidden="true" className="eo-brand__mark">KT</span>
          <span className="eo-brand__wordmark">KT Couriers</span>
        </Link>
        <button
          aria-label={railExpanded ? "Collapse navigation labels" : "Expand navigation labels"}
          aria-pressed={railExpanded}
          className="eo-rail-control"
          onClick={() => setRailExpanded((current) => !current)}
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d={railExpanded ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} /></svg>
        </button>
      </div>
      <p className="eo-desktop-navigation__context">{contextLabel}</p>
      <nav aria-label={`${contextLabel} sections`} className="eo-desktop-navigation__scroll">
        <ProtectedNavigationLinks compact={!railExpanded} groups={groups} />
      </nav>
      <div className="eo-desktop-navigation__account">
        <div className="eo-user-summary">
          <span aria-hidden="true" className="eo-avatar">{initials(user.displayName)}</span>
          <span className="eo-user-summary__copy"><strong>{user.displayName}</strong><small>{user.roleLabel}</small></span>
        </div>
        {footer ? <div className="eo-desktop-navigation__footer">{footer}</div> : null}
      </div>
    </aside>
  );
}
