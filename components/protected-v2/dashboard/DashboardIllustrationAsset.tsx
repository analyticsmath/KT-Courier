import { RouteQueueIllustration } from "@/components/protected-v2/illustrations/RouteQueueIllustration";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { SecureLedgerIllustration } from "@/components/protected-v2/illustrations/SecureLedgerIllustration";
import styles from "./dashboard.module.css";

export type DashboardIllustrationRole =
  | "admin"
  | "customer"
  | "driver"
  | "store"
  | "promoter"
  | "applicant";

export function DashboardIllustrationAsset({
  role,
  className = "",
}: {
  role: DashboardIllustrationRole;
  className?: string;
  preferSvg?: boolean;
}) {
  const illustration =
    role === "customer" || role === "store" ? (
      <ParcelDeskIllustration className={styles.illustrationArt} />
    ) : role === "driver" || role === "admin" ? (
      <RouteQueueIllustration className={styles.illustrationArt} />
    ) : role === "promoter" ? (
      <SecureLedgerIllustration className={styles.illustrationArt} />
    ) : (
      <AccessBoundaryIllustration className={styles.illustrationArt} />
    );

  return <div className={styles.illustrationFrame + " " + className}>{illustration}</div>;
}
