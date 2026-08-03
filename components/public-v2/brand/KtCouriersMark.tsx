import styles from "./brand.module.css";

type KtCouriersMarkProps = {
  className?: string;
  title?: string;
};

/** The R10 compact digital mark. It is a web utility asset, not a trademark claim. */
export function KtCouriersMark({ className, title }: KtCouriersMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      className={`${styles.mark}${className ? ` ${className}` : ""}`}
      role={labelled ? "img" : undefined}
      viewBox="0 0 64 64"
    >
      {title ? <title>{title}</title> : null}
      <rect fill="#101210" height="64" rx="10" width="64" />
      <path fill="#FFFFFF" d="M12 14h8v15l10-15h10L27 31l14 19H31L20 35v15h-8zM39 14h17v8h-5v28h-8V22h-4z" />
      <circle cx="52" cy="51" fill="#D83A2E" r="4" />
    </svg>
  );
}
