import Image from "next/image";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { ktMediaV3 } from "@/components/public-v3/media/kt-media-v3";
import { CoverageInteractiveView } from "./CoverageInteractiveView";
import styles from "./coverage-page.module.css";

interface CoveragePageProps {
  snapshot: PublicCoverageSnapshot;
}

export function CoveragePage({ snapshot }: CoveragePageProps) {
  return (
    <article className={styles.coverageRoot}>
      <div className={styles.coverageHeaderInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Coverage Areas" }]}
          />
        </div>

        <div className={styles.heroCopyBlock}>
          <h1 className={styles.heroTitle}>Where we deliver.</h1>
          <p className={styles.heroLead}>
            Availability is confirmed from the pickup and drop-off details in your request.
          </p>

          {/* Product Truth Contract (Accessible / Screen Reader disclosure) */}
          <div className="sr-only">
            Availability is confirmed from the pickup and drop-off details in your request. There is no postcode checker or anonymous live driver location tool on this page. The system does not treat an unavailable source as an empty coverage list.
          </div>
        </div>

        {/* Transit Corridor Aerial Hero Banner */}
        <div className="relative aspect-[21/9] sm:aspect-[24/8] w-full mt-8 overflow-hidden border border-[var(--kt-concrete)]/60 bg-[var(--kt-asphalt)]">
          <Image
            src={ktMediaV3.pages.coverage.hero.src}
            alt={ktMediaV3.pages.coverage.hero.alt}
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[var(--kt-freight-paper)]">
            <span className="text-xs font-mono uppercase tracking-widest bg-black/60 px-3 py-1">
              Transit Corridors
            </span>
            <span className="text-xs font-mono text-[var(--kt-concrete)] hidden sm:inline">
              Connecting roads and regional routes
            </span>
          </div>
        </div>
      </div>

      <CoverageInteractiveView snapshot={snapshot} />

      {/* Route Environments Photography Strip */}
      <section aria-label="Route Environments" className="max-w-6xl mx-auto px-6 md:px-12 py-16 border-t border-[var(--kt-concrete)]/40">
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--kt-road-grey)] block mb-2">
            Route Environments
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--kt-asphalt)]">
            Transit Corridors & Road Networks
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3 p-4 border border-[var(--kt-concrete)]/40 bg-[var(--kt-freight-paper)]">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--kt-concrete)]/20">
              <Image
                src={ktMediaV3.pages.coverage.skyline.src}
                alt={ktMediaV3.pages.coverage.skyline.alt}
                fill
                sizes="(max-width: 768px) 100vw, 30vw"
                className="object-cover"
              />
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">
              Urban routes
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              Metropolitan street grids and city distribution.
            </p>
          </div>

          <div className="space-y-3 p-4 border border-[var(--kt-concrete)]/40 bg-[var(--kt-freight-paper)]">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--kt-concrete)]/20">
              <Image
                src={ktMediaV3.pages.coverage.capeTown.src}
                alt={ktMediaV3.pages.coverage.capeTown.alt}
                fill
                sizes="(max-width: 768px) 100vw, 30vw"
                className="object-cover"
              />
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">
              Long-distance roads
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              Connecting transit links between hubs.
            </p>
          </div>

          <div className="space-y-3 p-4 border border-[var(--kt-concrete)]/40 bg-[var(--kt-freight-paper)]">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--kt-concrete)]/20">
              <Image
                src={ktMediaV3.pages.coverage.interchange.src}
                alt={ktMediaV3.pages.coverage.interchange.alt}
                fill
                sizes="(max-width: 768px) 100vw, 30vw"
                className="object-cover"
              />
            </div>
            <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">
              Regional movement
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              Highway networks and regional transfer points.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
