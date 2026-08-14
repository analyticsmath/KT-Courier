import Image from "next/image";
import styles from "./brand.module.css";

type KtCouriersWordmarkProps = {
  className?: string;
  compactMark?: boolean;
};

/** Uses the owner-supplied KT SVG directly; it is never redrawn or distorted. */
export function KtCouriersWordmark({ className, compactMark = false }: KtCouriersWordmarkProps) {
  return (
    <span className={`${styles.wordmark}${compactMark ? ` ${styles.wordmarkCompact}` : ""}${className ? ` ${className}` : ""}`}>
      <Image
        alt="KT Couriers"
        height={1024}
        sizes="(max-width: 767px) 128px, 184px"
        src="/images/kt-couriers/brand/logo.svg"
        width={1024}
      />
    </span>
  );
}
