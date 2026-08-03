"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = "right", className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title ?? "Menu"}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute top-0 bottom-0 w-72 bg-[var(--kt-surface)] shadow-xl flex flex-col",
          side === "right" ? "right-0 border-l border-[var(--kt-border)]" : "left-0 border-r border-[var(--kt-border)]",
          className
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--kt-border)]">
          {title && <span className="font-semibold text-[var(--kt-text)]">{title}</span>}
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-[var(--kt-surface-muted)] transition-colors text-[var(--kt-text-muted)]"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
