import Image from "next/image";
import Link from "next/link";
import { KtCouriersWordmark } from "@/components/public-v2/brand";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./public-shell.module.css";

export function PublicUtilityFooter() {
  return (
    <footer className={styles.footerRoot}>
      <div className={styles.footerInner}>
        {/* Asymmetric Spatial Layout */}
        <div className={styles.footerSpatialGrid}>
          {/* 1. Large Intent Cluster */}
          <div className={styles.footerIntentCluster}>
            <span className={styles.footerClusterHeading}>Movement Pathways</span>
            <ul className={styles.footerIntentList}>
              <li>
                <Link className={styles.footerLargeLink} href={marketplaceHref()}>
                  Marketplace Catalog &rarr;
                </Link>
              </li>
              <li>
                <Link className={styles.footerLargeLink} href="/services/pricing">
                  Delivery Pricing & Estimator &rarr;
                </Link>
              </li>
              <li>
                <Link className={styles.footerLargeLink} href="/services">
                  Movement Atlas (11 Routes) &rarr;
                </Link>
              </li>
              <li>
                <Link className={styles.footerLargeLink} href="/coverage-areas">
                  Coverage Corridors &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* 2. Brand & Operating Manifesto Plane */}
          <div className={styles.footerBrandPlane}>
            <Link aria-label="KT Couriers" className={styles.footerLogoLink} href="/">
              <KtCouriersWordmark compactMark />
            </Link>
            <p className={styles.footerManifesto}>
              South African marketplace ecosystem connecting local retailers, merchant kitchens, and independent senders with reliable courier delivery.
            </p>
          </div>

          {/* 3. Offset Partner & Information Column */}
          <div className={styles.footerSecondaryGroup}>
            <div className={styles.footerSubGroup}>
              <span className={styles.footerGroupHeader}>Participation</span>
              <ul className={styles.footerLinkList}>
                <li>
                  <Link className={styles.footerNavLink} href="/join">
                    Join the Network
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/signup?role=store">
                    Store Partner Account
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/services/driver-network">
                    Driver Network Information
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/membership">
                    Membership Information
                  </Link>
                </li>
              </ul>
            </div>

            <div className={styles.footerSubGroup}>
              <span className={styles.footerGroupHeader}>Company</span>
              <ul className={styles.footerLinkList}>
                <li>
                  <Link className={styles.footerNavLink} href="/about">
                    About KT Couriers
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/careers">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/faq">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/contact">
                    Contact Support
                  </Link>
                </li>
                <li>
                  <Link className={styles.footerNavLink} href="/safety">
                    Safety Standards
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 4. Lower Utility & Legal Bar */}
        <div className={styles.footerLowerUtility}>
          <div className={styles.footerLegalLinks}>
            <Link className={styles.footerLegalLink} href="/privacy-policy">
              Privacy Policy
            </Link>
            <Link className={styles.footerLegalLink} href="/terms">
              Terms of Service
            </Link>
            <Link className={styles.footerLegalLink} href="/cookie-policy">
              Cookie Policy
            </Link>
            <Link className={styles.footerLegalLink} href="/accessibility">
              Accessibility
            </Link>
          </div>

          <div className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. South Africa.
          </div>
        </div>

        {/* 5. Signature Final Frame */}
        <div className={styles.footerFinalFrame}>
          <div className={styles.footerWordmarkStage}>
            <span aria-hidden="true" className={styles.footerHugeWordmark}>
              KT COURIERS
            </span>
            <div className={styles.footerForegroundHorizon}>
              <Image
                alt={ktMedia.routes.johannesburgCorridor.alt || "Johannesburg urban corridor"}
                className={styles.footerHorizonImage}
                fill
                sizes="(max-width: 1024px) 100vw, 1680px"
                src={ktMedia.routes.johannesburgCorridor.src}
              />
              <div className={styles.footerHorizonOverlay} />
            </div>
          </div>
          <div className={styles.footerSignoff}>
            <span>SOUTH AFRICAN COMMERCE IN MOTION</span>
            <span>GAUTENG · WESTERN CAPE · KWAZULU-NATAL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
