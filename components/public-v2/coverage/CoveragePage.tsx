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
            Explore our active delivery regions across South Africa. Availability is confirmed from the pickup and drop-off details in your request.
          </p>

          <div className={styles.productTruthNotice}>
            <p className={styles.noticeText}>
              Availability is confirmed from the pickup and drop-off details in your request. There is no postcode checker or anonymous live driver location tool on this page. The system does not treat an unavailable source as an empty coverage list.
            </p>
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
              Active Regional Arterials
            </span>
            <span className="text-xs font-mono text-[var(--kt-concrete)] hidden sm:inline">
              Gauteng &bull; Western Cape &bull; Inter-Provincial Corridors
            </span>
          </div>
        </div>
      </div>

      <CoverageInteractiveView snapshot={snapshot} />

      {/* Active Corridor Photography Strip */}
      <section aria-label="Transit Corridors" className="max-w-6xl mx-auto px-6 md:px-12 py-16 border-t border-[var(--kt-concrete)]/40">
        <div className="mb-8">
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--kt-road-grey)] block mb-2">
            Physical Routes
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--kt-asphalt)]">
            Active South African Transit Arterials
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3 bg-white/60 p-4 border border-[var(--kt-concrete)]/60">
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
              Gauteng Metropolitan Grid
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              High-frequency urban dispatch connecting Johannesburg, Pretoria, Midrand, and surrounding commerce hubs.
            </p>
          </div>

          <div className="space-y-3 bg-white/60 p-4 border border-[var(--kt-concrete)]/60">
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
              Western Cape Coastal Corridor
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              Scheduled transport linking Cape Town city center, Atlantic seaboard, Northern Suburbs, and Winelands.
            </p>
          </div>

          <div className="space-y-3 bg-white/60 p-4 border border-[var(--kt-concrete)]/60">
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
              Inter-Provincial Hub Connectors
            </h3>
            <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
              Long-haul freight routing across national highway arteries connecting regional distribution centers.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}
