"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type EditorialTopbarProps = {
  contextLabel: string;
  user: { displayName: string; roleLabel: string; avatarUrl?: string | null };
  notifications?: { unreadCount: number; href: string };
  profileHref?: string;
  primaryAction?: { label: string; href: string };
  onNavigationOpen: () => void;
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "KT";
}

export function EditorialTopbar({
  contextLabel,
  user,
  notifications,
  profileHref,
  primaryAction,
  onNavigationOpen,
}: EditorialTopbarProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [accountOpen]);

  return (
    <header className="eo-topbar">
      <div className="eo-topbar__leading">
        <button aria-label="Open navigation" className="eo-icon-button eo-topbar__menu-button" onClick={onNavigationOpen} type="button">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Link aria-label="KT Couriers home" className="eo-topbar__brand" href="/"><span aria-hidden="true">KT</span></Link>
        <p className="eo-topbar__context">{contextLabel}</p>
      </div>
      <div className="eo-topbar__actions">
        {primaryAction ? <Link className="eo-topbar__primary-action" href={primaryAction.href}>{primaryAction.label}</Link> : null}
        {notifications ? (
          <Link aria-label={notifications.unreadCount > 0 ? `${notifications.unreadCount} unread notifications` : "Notifications"} className="eo-icon-button" href={notifications.href}>
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 22h4" /></svg>
            {notifications.unreadCount > 0 ? <span aria-hidden="true" className="eo-notification-count">{notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}</span> : null}
          </Link>
        ) : null}
        <div className="eo-topbar__account" ref={menuRef}>
          <button aria-expanded={accountOpen} aria-haspopup="menu" aria-label="Open account menu" className={cn("eo-avatar-button", accountOpen && "is-open")} onClick={() => setAccountOpen((current) => !current)} type="button">
            <span aria-hidden="true" className="eo-avatar">{initials(user.displayName)}</span>
            <span className="eo-topbar__user-copy"><strong>{user.displayName}</strong><small>{user.roleLabel}</small></span>
          </button>
          {accountOpen ? (
            <div aria-label="Account menu" className="eo-account-menu" role="menu">
              <p className="eo-account-menu__identity"><strong>{user.displayName}</strong><span>{user.roleLabel}</span></p>
              {profileHref ? <Link onClick={() => setAccountOpen(false)} role="menuitem" href={profileHref}>Profile and settings</Link> : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
