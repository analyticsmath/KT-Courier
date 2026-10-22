"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ProtectedIcon } from "@/components/protected-v2/icons/ProtectedIcon";
import { ProtectedAvatar } from "@/components/protected-v2/shell/ProtectedAvatar";
import type { ProtectedNavigationGroup, ProtectedNavigationItem } from "./types";

type ProtectedNavigationLinksProps = {
  groups: readonly ProtectedNavigationGroup[];
  onNavigate?: () => void;
  compact?: boolean;
  searchable?: boolean;
  onExpand?: () => void;
};

export function isProtectedNavigationItemCurrent(item: ProtectedNavigationItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProtectedNavigationLinks({ groups, onNavigate, compact = false, searchable = false, onExpand }: ProtectedNavigationLinksProps) {
  const pathname = usePathname();
  const instanceId = useId();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  // Only the permission-filtered server projection reaches this component.
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => `${group.label} ${item.label}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) })).filter((group) => group.items.length > 0);

  return (
    <div className="eo-navigation-links">
      {searchable && !compact ? <label className="eo-navigation-search"><span>Find a workspace</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search navigation" aria-label="Search navigation" /></label> : null}
      {visibleGroups.length === 0 ? <p role="status" className="eo-navigation-search">No matching destinations.</p> : null}
      {visibleGroups.map((group) => {
        const isOpen = !compact && (Boolean(query.trim()) || openGroups.has(group.id));
        return (
          <section className="eo-navigation-group" key={group.id}>
            <button
              aria-label={compact ? group.label : undefined}
              title={compact ? group.label : undefined}
              aria-controls={`${instanceId}-${group.id}`}
              aria-expanded={isOpen}
              className="eo-navigation-group__toggle"
              onClick={() => {
                if (compact) onExpand?.();
                setOpenGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                });
              }}
              type="button"
            >
              <ProtectedIcon className="eo-navigation-group__icon" name={group.items[0].icon} />
              <span className="eo-navigation-group__label">{group.label}</span>
              <svg aria-hidden="true" className={cn("eo-navigation-group__chevron", !isOpen && "-rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="m8 10 4 4 4-4" /></svg>
            </button>
            {isOpen ? (
              <ul className="eo-navigation-group__items" id={`${instanceId}-${group.id}`}>
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
  searchable?: boolean;
};

export function ProtectedDesktopNavigation({ contextLabel, groups, user, footer, searchable }: ProtectedDesktopNavigationProps) {

  const [expanded, setExpanded] = useState(false);
  return (
    <aside aria-label={`${contextLabel} primary navigation`} className={cn("eo-desktop-navigation", expanded && "is-rail-expanded")}>
      <div className="eo-desktop-navigation__brand">
        <Link aria-label="KT Couriers home" className="eo-brand" href="/">
          <span className="eo-brand__mark flex items-center justify-center p-0.5 overflow-hidden !bg-transparent !border-0">
            <Image
              src="/media/public/illustrations/logo.svg"
              alt="KT Couriers logo"
              width={32}
              height={32}
              unoptimized
              className="w-full h-full object-contain"
              priority
            />
          </span>
          <span className="eo-brand__wordmark">KT Couriers</span>
        </Link>

      </div>
      <button className="eo-rail-control" type="button" aria-label={expanded ? "Collapse navigation" : "Expand navigation"} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}><span aria-hidden="true">{expanded ? "‹" : "›"}</span></button>
      <p className="eo-desktop-navigation__context">{contextLabel}</p>
      <nav aria-label={`${contextLabel} sections`} className="eo-desktop-navigation__scroll">
        <ProtectedNavigationLinks compact={!expanded} onExpand={()=>setExpanded(true)} groups={groups} searchable={searchable} />
      </nav>
      <div className="eo-desktop-navigation__account">
        <div className="eo-user-summary">
          <ProtectedAvatar name={user.displayName} src={user.avatarUrl} />
          <span className="eo-user-summary__copy"><strong>{user.displayName}</strong><small>{user.roleLabel}</small></span>
        </div>
        {footer ? <div className="eo-desktop-navigation__footer">{footer}</div> : null}
      </div>
    </aside>
  );
}
