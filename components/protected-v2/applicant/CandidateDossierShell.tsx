import Link from "next/link";
import { ProtectedVisualRoot } from "@/components/protected-v2/foundation/ProtectedVisualRoot";
import styles from "./candidate-dossier.module.css";

export function CandidateDossierShell({ children }: { children: React.ReactNode }) {
  return <ProtectedVisualRoot><a className="eo-skip-link" href="#candidate-main-content">Skip to application content</a><div className={styles.shell}><header className={styles.header}><Link href="/applicant" className={styles.brand}>KT <span>Couriers</span><small>Candidate dossier</small></Link><nav aria-label="Candidate workspace"><Link href="/applicant/applications">Applications</Link><Link href="/applicant/privacy">Privacy</Link><Link href="/careers">Return to careers</Link></nav></header><main id="candidate-main-content" className={styles.main}>{children}</main></div></ProtectedVisualRoot>;
}
