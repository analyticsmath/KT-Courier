"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useOverlayFocus } from "./useOverlayFocus";

type ProtectedDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  className?: string;
};

export function ProtectedDialog({
  open,
  onClose,
  title,
  description,
  children,
  closeOnBackdrop = true,
  className,
}: ProtectedDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useOverlayFocus(open, onClose, surfaceRef, closeButtonRef);

  if (!open) return null;

  return (
    <div className="eo-overlay eo-overlay--centred" role="presentation">
      <button aria-label="Close dialog" className="eo-overlay__backdrop" onClick={closeOnBackdrop ? onClose : undefined} tabIndex={-1} type="button" />
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn("eo-dialog", className)}
        ref={surfaceRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="eo-dialog__header">
          <div className="min-w-0">
            <h2 className="eo-dialog__title" id={titleId}>{title}</h2>
            {description ? <p className="eo-dialog__description" id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label={`Close ${title}`} className="eo-icon-button" onClick={onClose} ref={closeButtonRef} type="button">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="eo-dialog__body">{children}</div>
      </section>
    </div>
  );
}
