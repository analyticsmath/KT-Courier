import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { AtlasViewerClient } from "./AtlasViewerClient";
import styles from "./service-pages.module.css";

export function ServicesOverviewPage() {
  return (
    <article className={styles.atlasPage}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.pageInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Services" }]}
          />
        </div>

        <section aria-labelledby="atlas-heading" className={styles.atlasHero}>
          <h1 className={styles.atlasHeroTitle} id="atlas-heading">
            The Movement Atlas.
          </h1>
          <p className={styles.atlasHeroLead}>
            Explore courier, merchant logistics, planned transit, and pricing pathways organized around what you are sending and how it moves across South African corridors.
          </p>
        </section>

        <AtlasViewerClient />
      </div>
    </article>
  );
}
