import Link from "next/link";
import Image from "next/image";
import { ProtectedVisualRoot } from "@/components/protected-v2/foundation/ProtectedVisualRoot";
import styles from "./candidate-dossier.module.css";

export function CandidateDossierShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedVisualRoot>
      <a className="eo-skip-link" href="#candidate-main-content">
        Skip to application content
      </a>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/applicant" className="flex items-center gap-3 no-underline">
            <Image
              src="/media/public/illustrations/logo.svg"
              alt="KT Couriers"
              width={110}
              height={26}
              priority
              className="h-6 w-auto object-contain"
            />
            <span className="text-[11px] font-semibold text-[var(--eo-text-muted)] tracking-tight">
              Candidate dossier
            </span>
          </Link>
          <nav aria-label="Candidate workspace">
            <Link href="/applicant/applications">Applications</Link>
            <Link href="/applicant/privacy">Privacy</Link>
            <Link href="/careers">Return to careers</Link>
          </nav>
        </header>
        <main id="candidate-main-content" className={styles.main}>
          {children}
        </main>
      </div>
    </ProtectedVisualRoot>
  );
}
