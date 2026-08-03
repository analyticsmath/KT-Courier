import { KtCouriersMark } from "./KtCouriersMark";
import styles from "./brand.module.css";

type KtCouriersWordmarkProps = {
  className?: string;
  compactMark?: boolean;
};

/**
 * Text remains the primary public identity. The optional compact mark is
 * decorative here so linked wordmarks retain the predictable name “KT Couriers”.
 */
export function KtCouriersWordmark({ className, compactMark = false }: KtCouriersWordmarkProps) {
  return (
    <span className={`${styles.wordmark}${className ? ` ${className}` : ""}`}>
      {compactMark ? <KtCouriersMark /> : null}
      <span>KT Couriers</span>
    </span>
  );
}
