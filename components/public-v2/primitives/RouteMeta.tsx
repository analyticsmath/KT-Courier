import styles from "./primitives.module.css";

export type RouteMetaProps = {
  routeCode: string;
  status?: string;
  detail?: string;
  className?: string;
};

export function RouteMeta({
  routeCode,
  status,
  detail,
  className = "",
}: RouteMetaProps) {
  return (
    <div className={`${styles.routeMeta} ${className}`.trim()}>
      <span aria-hidden="true" className={styles.routeDot} />
      <span className={styles.routeCode}>{routeCode}</span>
      {status && <span>{status}</span>}
      {detail && <span>— {detail}</span>}
    </div>
  );
}
