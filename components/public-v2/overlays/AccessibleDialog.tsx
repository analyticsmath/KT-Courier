"use client";

import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "@/lib/utils/cn";

type BodyScrollLock = {
  scrollY: number;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
};

let bodyScrollLock: BodyScrollLock | null = null;

function lockDocumentScroll() {
  if (bodyScrollLock) return;

  const body = document.body;
  const scrollY = window.scrollY;
  bodyScrollLock = {
    scrollY,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function unlockDocumentScroll() {
  if (!bodyScrollLock) return;

  const body = document.body;
  const { scrollY, position, top, left, right, width, overflow } = bodyScrollLock;
  body.style.position = position;
  body.style.top = top;
  body.style.left = left;
  body.style.right = right;
  body.style.width = width;
  body.style.overflow = overflow;
  bodyScrollLock = null;
  window.scrollTo(0, scrollY);
}

export type AccessibleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdropClick?: boolean;
  closeLabel?: string;
  className?: string;
};

/**
 * Controlled native dialog foundation for new public-only overlays. Native
 * modal behavior provides the focus boundary; this component restores focus,
 * preserves page position, and keeps background closing explicitly opt-in.
 */
export function AccessibleDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  ariaLabel,
  ariaDescribedBy,
  initialFocusRef,
  closeOnBackdropClick = false,
  closeLabel = "Close dialog",
  className,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const titleId = useId();
  const descriptionId = useId();
  const hasTitle = title !== undefined && title !== null;
  const describedBy = [description ? descriptionId : undefined, ariaDescribedBy]
    .filter(Boolean)
    .join(" ") || undefined;

  if (process.env.NODE_ENV !== "production" && !hasTitle && !ariaLabel) {
    throw new Error("AccessibleDialog: provide title or ariaLabel for an accessible dialog name.");
  }

  useEffect(() => {
    openRef.current = open;
    onOpenChangeRef.current = onOpenChange;
  }, [open, onOpenChange]);

  const restoreFocus = useCallback(() => {
    const lastFocusedElement = lastFocusedElementRef.current;
    lastFocusedElementRef.current = null;

    if (!lastFocusedElement?.isConnected) return;

    window.requestAnimationFrame(() => lastFocusedElement.focus());
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dialog.showModal();
      lockDocumentScroll();

      window.requestAnimationFrame(() => {
        const target = initialFocusRef?.current
          ?? dialog.querySelector<HTMLElement>("[data-kt-public-dialog-close]");
        target?.focus();
      });
    }

    if (!open && dialog.open) {
      dialog.close();
      unlockDocumentScroll();
      restoreFocus();
    }
  }, [initialFocusRef, open, restoreFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;

    return () => {
      if (dialog?.open) dialog.close();
      unlockDocumentScroll();
    };
  }, []);

  const requestClose = useCallback(() => onOpenChangeRef.current(false), []);

  const handleCancel = useCallback((event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  }, [requestClose]);

  const handleNativeClose = useCallback(() => {
    unlockDocumentScroll();
    restoreFocus();

    if (openRef.current) onOpenChangeRef.current(false);
  }, [restoreFocus]);

  const handleBackdropClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdropClick) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom;

    if (clickedBackdrop) requestClose();
  }, [closeOnBackdropClick, requestClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-describedby={describedBy}
      aria-label={hasTitle ? undefined : ariaLabel}
      aria-labelledby={hasTitle ? titleId : undefined}
      className={cn("kt-public-dialog", className)}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onClose={handleNativeClose}
    >
      <div className="kt-public-dialog__header">
        {hasTitle ? <h2 className="kt-public-dialog__title" id={titleId}>{title}</h2> : <span />}
        <button
          aria-label={closeLabel}
          className="kt-public-dialog__close"
          data-kt-public-dialog-close
          onClick={requestClose}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
      <div className="kt-public-dialog__body">
        {description ? <div className="kt-public-dialog__description" id={descriptionId}>{description}</div> : null}
        {children}
      </div>
    </dialog>
  );
}
