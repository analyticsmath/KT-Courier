import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import type { PublicCareerOpeningsSnapshot } from "@/lib/public-careers/openings";
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
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Careers" }]}
          />
        </div>

        <section aria-labelledby="careers-title" className={styles.careersHero}>
          <h1 className={styles.careersTitle} id="careers-title">
            Work behind the movement.
          </h1>
          <p className={styles.careersLead}>
            Published roles appear here when recruitment makes an opening available. Each position maintains its own verified description and direct application path.
          </p>
        </section>

        {/* Editorial Role List */}
        <section aria-labelledby="openings-heading" className={styles.openingsSection}>
          <h2 className={styles.openingsHeading} id="openings-heading">
            Current Published Positions ({openings.length})
          </h2>

          {snapshot.state === "SOURCE_UNAVAILABLE" ? (
            <div className={styles.emptyStateNotice}>
              <p className={styles.emptyStateTitle}>SOURCE_UNAVAILABLE: Role list temporarily unavailable</p>
              <p className={styles.emptyStateText}>
                We are currently updating our careers database. Please contact the team for recruitment questions.
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
