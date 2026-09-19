import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { ParticipationRoleSelector } from "./ParticipationRoleSelector";
import styles from "./participation.module.css";

export function ParticipationPage() {
  return (
    <article className={styles.joinRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Join the Network", href: "/join" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.joinInner}>
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
          >
            ← Home
          </Link>
        </div>

        <section aria-labelledby="join-title" className={styles.joinHero}>
          <h1 className={styles.joinTitle} id="join-title">
            Join the Network.
          </h1>
          <p className={styles.joinLead}>
            Explore the participation pathways for merchant stores, courier drivers, and regional network promoters.
          </p>
        </section>

        <ParticipationRoleSelector />
      </div>
    </article>
  );
}
