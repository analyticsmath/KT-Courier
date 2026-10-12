import Link from "next/link";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import styles from "@/components/protected-v2/driver/driver-pages.module.css";

export function DriverEarningsUnavailable() {
  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Driver account" title="Earnings" />
    <ProtectedState kind="restricted" title="Earnings unavailable" description="Earnings are available to active, approved drivers. Review your onboarding status to see the next steps." action={<Link className="eo-driver-button eo-driver-button--secondary" href="/driver/onboarding">Review onboarding status</Link>} />
  </ProtectedPageFrame></div>;
}
