import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbScript, PublicDataState, SupportingClosingCta, SupportingPageHero } from "@/components/public-v2/support";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import type { PublicCareerOpeningsSnapshot } from "@/lib/public-careers/openings";
import styles from "@/components/public-v2/support/support-pages.module.css";

function displayLabel(value?: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function displayDate(value?: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value);
}

export function CareersPage({ snapshot }: { snapshot: PublicCareerOpeningsSnapshot }) {
  const media = getSupportingPageMedia("careers-context");
  const openingAction = snapshot.state === "AVAILABLE" && snapshot.openings.length
    ? { label: "View current roles", href: "#open-roles" }
    : { label: "Contact KT Couriers", href: "/contact" };

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Careers", href: "/careers" }]} />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Careers" }]}
        eyebrow="Careers"
        title="Work behind the movement."
        summary="Published roles appear here when recruitment makes an opening available. Each role keeps its own details and canonical application path."
        primaryAction={openingAction}
        secondaryAction={{ label: "Driver network information", href: "/services/driver-network" }}
        media={media}
        variant="recruitment"
      />

      <section className={styles.section} aria-labelledby="careers-context-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Working context</p>
          <div className={styles.careersIntro}>
            <div>
              <h2 className={styles.sectionHeading} id="careers-context-heading">Roles are published deliberately, with their own application context.</h2>
            </div>
            <div>
              <p className={styles.bodyCopy}>KT Couriers separates published recruitment openings from driver-network participation information. A public role is shown only when the recruitment service marks it published.</p>
              <p className={styles.bodyCopy}>The role detail page is the canonical place to read the position and begin an application. This page does not collect applications or offer a general candidate portal.</p>
              <p className={styles.inlineNote}>KT Couriers never charges applicants any application, screening, or placement fee.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="open-roles" aria-labelledby="open-roles-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Published opportunities</p>
          <h2 className={styles.sectionHeading} id="open-roles-heading">Current published roles</h2>
          {snapshot.state === "SOURCE_UNAVAILABLE" ? (
            <PublicDataState eyebrow="Opportunity list unavailable" title="Current role information could not be loaded for this page." action={{ label: "Contact KT Couriers", href: "/contact" }}>
              <p>This does not mean that there are no openings. Use the contact route for a general question while the current public role list is unavailable.</p>
            </PublicDataState>
          ) : snapshot.openings.length === 0 ? (
            <PublicDataState eyebrow="No published openings" title="There are no roles published here at present.">
              <p>When an opening is published by recruitment, its title, detail page, and application pathway will appear in this list. No speculative roles or general application form are shown.</p>
            </PublicDataState>
          ) : (
            <div className={styles.roleList}>
              <ul className={styles.roleList} aria-label="Published job openings">
                {snapshot.openings.map((opening) => {
                  const location = opening.primaryLocation ?? displayLabel(opening.locationPolicy);
                  const classification = displayLabel(opening.relationshipClassification);
                  const closes = displayDate(opening.applicationClosesAt);
                  return (
                    <li key={opening.openingReference}>
                      <article className={styles.roleRow}>
                        <div>
                          <p className={styles.roleMeta}><span>Published</span>{opening.track ? <span>{displayLabel(opening.track)}</span> : null}</p>
                          <h3 className={styles.roleTitle}>{opening.title}</h3>
                          <p className={styles.roleMeta}>{location ? <span>{location}</span> : null}{classification ? <span>{classification}</span> : null}{closes ? <span>Closes {closes}</span> : null}</p>
                          <p className={styles.roleSummary}>{opening.summary}</p>
                        </div>
                        <Link className={`${styles.secondaryAction} ${styles.roleAction}`} href={`/careers/jobs/${opening.openingReference}`}>View role <span aria-hidden="true">→</span></Link>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="candidate-guidance-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Before applying</p>
          <div className={styles.mediaSplit}>
            <div>
              <h2 className={styles.sectionHeading} id="candidate-guidance-heading">Use the exact role pathway.</h2>
              <p className={styles.sectionIntro}>Read the responsibilities and criteria in the published opening before starting its application. The application flow retains the opening reference and its current version.</p>
              <p className={styles.inlineNote}>Reasonable accommodation information is included with published openings. If there is no published role, this page does not invite a speculative application.</p>
            </div>
            <figure className={styles.mediaFrame}>
              <Image alt={media.alt} fill sizes="(max-width: 767px) calc(100vw - 40px), 38vw" src={media.src} style={{ objectPosition: media.focalPoint }} />
              <figcaption className={styles.mediaCaption}>Provisional operational context · not an employee portrait</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <SupportingClosingCta
          eyebrow="Separate pathways"
          title="Looking for driver-network information instead?"
          summary="The driver-network page explains the current contact-led participation route. It is separate from published recruitment openings."
          primaryAction={{ label: "Driver network information", href: "/services/driver-network" }}
          secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        />
      </div>
    </article>
  );
}
