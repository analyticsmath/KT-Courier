import Image from "next/image";
import { OperationsSceneIllustration } from "@/components/protected-v2/illustrations/OperationsSceneIllustration";
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
  const artwork: Partial<Record<DashboardIllustrationRole, string>> = {
    customer: "/media/dashboard/delivery-proof.webp",
    store: "/media/dashboard/merchant-handoff.webp",
    driver: "/media/dashboard/courier-hand-off.webp",
  };
  const illustration = artwork[role] ? (
    <Image src={artwork[role]} alt="" width={440} height={280} className={styles.illustrationArt} sizes="(max-width: 768px) 150px, 280px" />
  ) : role === "admin" ? (
    <OperationsSceneIllustration className={styles.illustrationArt} />
  ) : role === "promoter" ? (
    <SecureLedgerIllustration className={styles.illustrationArt} />
  ) : (
    <AccessBoundaryIllustration className={styles.illustrationArt} />
  );

  return <div className={styles.illustrationFrame + " " + className}>{illustration}</div>;
}
