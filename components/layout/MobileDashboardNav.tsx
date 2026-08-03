"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "@/components/ui/Drawer";
import { cn } from "@/lib/utils/cn";
import type { NavItem } from "@/types/navigation";

interface MobileDashboardNavProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  title?: string;
  footer?: React.ReactNode;
}

export function MobileDashboardNav({
  open,
  onClose,
  navItems,
  title,
  footer,
}: MobileDashboardNavProps) {
  const pathname = usePathname();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title ?? "KT Couriers"}
      side="left"
      className="w-72 bg-[var(--kt-studio-white)]"
    >
      <nav
        className="flex flex-col px-3 py-3 space-y-0.5"
        aria-label="Mobile dashboard navigation"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href + "/") && item.href !== "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[var(--kt-cloud-blue)] text-[var(--kt-signal-cobalt)] font-bold"
                  : "text-[var(--kt-text-muted)] hover:bg-[var(--kt-cool-gray)] hover:text-[var(--kt-ink-navy)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="truncate flex-1">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto text-[10px] font-extrabold bg-[var(--kt-signal-cobalt)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {footer && (
        <div className="px-3 py-3 border-t border-[var(--kt-soft-border)] mt-auto">
          {footer}
        </div>
      )}
    </Drawer>
  );
}
