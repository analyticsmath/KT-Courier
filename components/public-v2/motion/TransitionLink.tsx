"use client";

import React, { useCallback } from "react";
import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";

interface TransitionLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  "aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean;
  role?: string;
  id?: string;
  tabIndex?: number;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function TransitionLink({
  href,
  children,
  onClick,
  ...props
}: TransitionLinkProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
      }

      // Allow default browser behavior for modifier keys, right click, etc.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }

      const strHref = typeof href === "string" ? href : href.pathname || "";
      if (
        strHref.startsWith("http://") ||
        strHref.startsWith("https://") ||
        strHref.startsWith("mailto:") ||
        strHref.startsWith("tel:")
      ) {
        return;
      }

      // Check if Document View Transition API is supported
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        e.preventDefault();
        (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(
          () => {
            router.push(strHref);
          }
        );
      }
    },
    [href, onClick, router]
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
