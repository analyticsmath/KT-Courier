import styles from "./primitives.module.css";

export type SectionIndexProps = {
  index: string;
  label?: string;
  theme?: "light" | "dark";
  className?: string;
};

export function SectionIndex({
  index,
  label,
  theme = "light",
  className = "",
}: SectionIndexProps) {
  return (
    <div className={`${styles.sectionIndex} ${className}`.trim()}>
      <span>{index}</span>
      {label && <span>{label}</span>}
      <span
        aria-hidden="true"
        className={`${styles.sectionIndexRule} ${theme === "dark" ? styles.sectionIndexRuleDark : ""}`}
      />
    </div>
  );
}
