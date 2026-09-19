import Image from "next/image";
import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import type { PublicCareerOpeningsSnapshot } from "@/lib/public-careers/openings";
import { ktMediaV3 } from "@/components/public-v3/media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./careers-page.module.css";

function displayLabel(value?: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayDate(value?: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

interface CareersPageProps {
  snapshot: PublicCareerOpeningsSnapshot;
}

export function CareersPage({ snapshot }: CareersPageProps) {
  const openings = snapshot.openings || [];

  return (
    <article className={styles.careersRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Careers", href: "/careers" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.careersInner}>
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
          >
            ← Home
          </Link>
        </div>

        {/* Giant Low-Contrast Background Typography */}
        <div aria-hidden="true" className="font-display text-[clamp(4.5rem,16vw,12rem)] font-black tracking-tighter leading-none text-[var(--kt-concrete)]/60 uppercase select-none pointer-events-none -mb-6 sm:-mb-10">
          CAREERS
        </div>

        <section aria-labelledby="careers-title" className={styles.careersHero}>
          <h1 className={styles.careersTitle} id="careers-title">
            Work behind the movement.
          </h1>
          <p className={styles.careersLead}>
            Published roles appear here when recruitment makes an opening available. Each position maintains its own verified description and direct application path.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] border border-[var(--kt-concrete)]/60 font-mono text-xs text-[var(--kt-road-grey)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--kt-asphalt)]" />
            <span>Zero Applicant Fees &bull; KT Couriers never charges application or onboarding fees</span>
          </div>
        </section>

        {/* Documentary Operations Photo Stage */}
        <div className="relative aspect-[21/9] sm:aspect-[24/8] w-full mb-12 overflow-hidden border border-[var(--kt-concrete)]/60 bg-[var(--kt-asphalt)]">
          <Image
            src={ktMediaV3.pages.join.driverHero.src}
            alt={ktMediaV3.pages.join.driverHero.alt}
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1200px"
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)]/80 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[var(--kt-freight-paper)]">
            <span className="text-xs font-mono uppercase tracking-widest bg-black/60 px-3 py-1">
              Fleet Operations &bull; Dispatch Hub
            </span>
            <span className="text-xs font-mono text-[var(--kt-concrete)] hidden sm:inline">
              Johannesburg Central Hub & Regional Depots
            </span>
          </div>
        </div>

        {/* Editorial Role List */}
        <section aria-labelledby="openings-heading" className={styles.openingsSection}>
          <h2 className={styles.openingsHeading} id="openings-heading">
            Current Published Positions ({openings.length})
          </h2>

          {snapshot.state === "SOURCE_UNAVAILABLE" ? (
            <div className={styles.emptyStateNotice}>
              <p className={styles.emptyStateTitle}>We can’t load the latest openings right now. Please try again shortly or contact KT.</p>
              <p className={styles.emptyStateText}>
                We are updating our positions list. Please contact our team directly for recruitment and career inquiries.
              </p>
              <Link className={styles.emptyStateAction} href="/contact">
                Contact KT Couriers &rarr;
              </Link>
            </div>
          ) : openings.length === 0 ? (
            <div className={styles.emptyStateNotice}>
              <p className={styles.emptyStateTitle}>No published openings available currently</p>
              <p className={styles.emptyStateText}>
                When new positions open across operations, dispatch, technology, or regional logistics, they will appear here with complete application instructions.
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--kt-muted, #5f6763)", marginTop: 12 }}>
                No application or screening fees are charged. KT Couriers never charges applicants. Contact us for accessibility accommodations.
              </p>
            </div>
          ) : (
            <ul className={styles.roleList}>
              {openings.map((opening) => {
                const location =
                  opening.primaryLocation ?? displayLabel(opening.locationPolicy);
                const classification = displayLabel(opening.relationshipClassification);
                const closes = displayDate(opening.applicationClosesAt);

                return (
                  <li className={styles.roleItem} key={opening.openingReference}>
                    <div className={styles.roleHeader}>
                      <div className={styles.roleMetaRow}>
                        {opening.track && (
                          <span className={styles.roleTrackBadge}>
                            {displayLabel(opening.track)}
                          </span>
                        )}
                        {location && <span className={styles.roleLocation}>{location}</span>}
                        {classification && (
                          <span className={styles.roleClassification}>{classification}</span>
                        )}
                        {closes && <span className={styles.roleClosingDate}>Closes {closes}</span>}
                      </div>

                      <h3 className={styles.roleTitle}>{opening.title}</h3>
                    </div>

                    <p className={styles.roleSummary}>{opening.summary}</p>

                    <div className={styles.roleActionRow}>
                      <Link
                        className={styles.roleLink}
                        href={`/careers/jobs/${opening.openingReference}`}
                      >
                        <span>View position details</span>
                        <KtIconArrowRight size={16} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
