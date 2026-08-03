"use client";

import type { NativeScrollerProgressStyle } from "./native-scroller-types";
import { getNativeScrollerProgress } from "./native-scroller-utils";
import styles from "./native-scroller.module.css";

type ScrollerProgressProps = {
  activeIndex: number;
  itemCount: number;
  presentation: NativeScrollerProgressStyle;
};

export function ScrollerProgress({ activeIndex, itemCount, presentation }: ScrollerProgressProps) {
  if (presentation === "none") return null;

  const progress = getNativeScrollerProgress(activeIndex, itemCount);
  const showCount = presentation === "count" || presentation === "both";
  const showBar = presentation === "bar" || presentation === "both";

  return (
    <div className={styles.progress} aria-label={`Item ${progress.current} of ${progress.total}`}>
      {showCount ? (
        <span className={styles.count}>
          {String(progress.current).padStart(2, "0")} / {String(progress.total).padStart(2, "0")}
        </span>
      ) : null}
      {showBar ? (
        <span aria-hidden="true" className={styles.bar}>
          <span className={styles.barFill} style={{ transform: `scaleX(${progress.ratio})` }} />
        </span>
      ) : null}
    </div>
  );
}
