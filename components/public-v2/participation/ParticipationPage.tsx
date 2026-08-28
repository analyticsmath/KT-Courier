import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
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
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Join" }]}
          />
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
