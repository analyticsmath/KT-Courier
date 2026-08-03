"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useOverlayFocus } from "./useOverlayFocus";

type ProtectedDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  fullScreen?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
};

export function ProtectedDrawer({
  open,
  onClose,
  title,
  description,
  children,
  side = "left",
  fullScreen = false,
  closeOnBackdrop = true,
  className,
}: ProtectedDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const surfaceRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useOverlayFocus(open, onClose, surfaceRef, closeButtonRef);

  if (!open) return null;

  return (
    <div className="eo-overlay" role="presentation">
      <button
        aria-label="Close navigation"
        className="eo-overlay__backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "eo-drawer",
          side === "right" ? "eo-drawer--right" : "eo-drawer--left",
          fullScreen && "eo-drawer--full-screen",
          className,
        )}
        ref={surfaceRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="eo-drawer__header">
          <div className="min-w-0">
            <h2 className="eo-drawer__title" id={titleId}>{title}</h2>
            {description ? <p className="eo-drawer__description" id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label={`Close ${title}`} className="eo-icon-button" onClick={onClose} ref={closeButtonRef} type="button">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="eo-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
