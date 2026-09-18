"use client";

import { type ReactNode } from "react";

interface ActorOcclusionTransitionProps {
  children: ReactNode;
  occlusionElement: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Actor Occlusion Transition Primitive.
 * Places a physical occlusion element (e.g. giant typography, trailer body, foreground barrier)
 * in front of an actor so orientation or state swaps are completely concealed.
 */
export function ActorOcclusionTransition({
  children,
  occlusionElement,
  className = "",
  style = {},
}: ActorOcclusionTransitionProps) {
  return (
    <div
      className={`kt-occlusion-transition-boundary relative overflow-hidden ${className}`}
      style={style}
    >
      <div className="actor-under-plane z-10">{children}</div>
      <div className="occlusion-over-plane pointer-events-none z-20">
        {occlusionElement}
      </div>
    </div>
  );
}
