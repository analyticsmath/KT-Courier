import Image from "next/image";
import Link from "next/link";
import type { PublicBreadcrumbItem } from "@/components/public-v2/navigation";
import { RouteLine } from "@/components/public-v2/graphics";
import type { SupportingPageMediaAsset } from "@/lib/public-assets/supporting-page-media";
import styles from "./support-pages.module.css";

export type PublicAction = { label: string; href: string };

export type SupportingPageHeroProps = {
  breadcrumb: readonly PublicBreadcrumbItem[];
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction?: PublicAction;
  secondaryAction?: PublicAction;
  media?: SupportingPageMediaAsset;
  variant: "institutional" | "geographic" | "membership" | "recruitment" | "reading" | "contact";
};

export function SupportingPageHero({
  breadcrumb: _breadcrumb,
  eyebrow,
  title,
  summary,
  primaryAction,
  secondaryAction,
  media,
  variant,
}: SupportingPageHeroProps) {
  return (
    <>
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
        >
          ← Home
        </Link>
      </div>
      <section className={styles.hero} data-kt-support-hero={variant}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.heroSummary}>{summary}</p>
          {(primaryAction || secondaryAction) ? (
            <div className={styles.actionGroup}>
              {primaryAction ? <Link className={styles.primaryAction} href={primaryAction.href}>{primaryAction.label} <span aria-hidden="true">→</span></Link> : null}
              {secondaryAction ? <Link className={styles.secondaryAction} href={secondaryAction.href}>{secondaryAction.label} <span aria-hidden="true">→</span></Link> : null}
            </div>
          ) : null}
        </div>
        {media ? (
          <figure className={styles.heroMedia}>
            <Image
              alt={media.alt}
              fill
              priority
              sizes="(max-width: 767px) calc(100vw - 40px), 44vw"
              src={media.src}
              style={{ objectPosition: media.focalPoint }}
            />
            <RouteLine className={styles.heroRoute} segment="hero" variant="hero" />
            <figcaption>Provisional campaign media · replacement pending</figcaption>
          </figure>
        ) : null}
      </section>
    </>
  );
}
