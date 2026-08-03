"use client";

import { useEffect, useRef } from "react";

type HeaderScrollStateProps = {
  onScrolledChange: (scrolled: boolean) => void;
  className?: string;
};

/**
 * A one-pixel sentinel keeps sticky-header elevation event-driven. It avoids a
 * continuous scroll listener and leaves the non-JavaScript header unchanged.
 */
export function HeaderScrollState({ onScrolledChange, className }: HeaderScrollStateProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    let disposed = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (disposed) return;

      onScrolledChange(!entry.isIntersecting);
    });

    observer.observe(sentinel);

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [onScrolledChange]);

  return <div aria-hidden="true" className={className} ref={sentinelRef} />;
}
