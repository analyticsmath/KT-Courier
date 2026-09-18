import type { CSSProperties, ReactNode } from "react";
import styles from "./primitives.module.css";

export type MediaFrameProps = {
  children: ReactNode;
  aspectRatio?: string;
  forwardCut?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function MediaFrame({
  children,
  aspectRatio = "16 / 10",
  forwardCut = false,
  className = "",
  style = {},
}: MediaFrameProps) {
  return (
    <div
      className={`${styles.mediaFrame} ${forwardCut ? styles.mediaFrameForwardCut : ""} ${className}`.trim()}
      style={{ aspectRatio, ...style }}
    >
      {children}
    </div>
  );
}
