import Link from "next/link";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import styles from "./store-pages.module.css";

export function StoreCommercialUnavailablePage({ eyebrow = "Store account", title, description, stateTitle, stateDescription, backHref = "/store", backLabel = "Back to store operations" }: { eyebrow?: string; title: string; description: string; stateTitle: string; stateDescription: string; backHref?: string; backLabel?: string }) {
  return <div className={styles.scope}><ProtectedPageFrame><ProtectedPageHeader eyebrow={eyebrow} title={title} description={description} /><ProtectedState kind="locked" title={stateTitle} description={stateDescription} illustration={<AccessBoundaryIllustration className="h-24 w-32" />} action={<Link className="eo-button eo-button--secondary" href={backHref}>{backLabel}</Link>} /></ProtectedPageFrame></div>;
}
