"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import styles from "./participation.module.css";

const pathways = [
  {
    id: "store",
    title: "Store Partners & Merchants",
    tagline: "Publish your store catalog and coordinate courier delivery for customer orders.",
    badge: "MERCHANT ORIGIN",
    requirements: [
      "Merchant business details confirmed during account registration",
      "Collection address configured within active delivery regions",
      "Catalog items suitable for standard courier dispatch",
    ],
    action: { label: "Create store account", href: "/signup?role=store" },
    media: homeMedia.merchantPrepare,
  },
  {
    id: "driver",
    title: "Driver & Courier Network",
    tagline: "Provide courier delivery across designated hubs and regional transit routes.",
    badge: "COURIER PROTO-01",
    requirements: [
      "Licensing and documentation confirmed during onboarding",
      "Route familiarity in active delivery corridors",
      "Dedicated courier dispatch coordination",
    ],
    action: { label: "Driver network information", href: "/services/driver-network" },
    media: homeMedia.handoff,
  },
  {
    id: "promoter",
    title: "Promoters & Ambassadors",
    tagline: "Connect local merchants and customers with the KT marketplace and delivery network.",
    badge: "REGIONAL SCALE",
    requirements: [
      "Active local network in configured regions",
      "Account-based partner coordination with the KT team",
      "Program guidelines confirmed during setup",
    ],
    action: { label: "Inquire about promoter partnership", href: "/contact" },
    media: homeMedia.worldMarket,
  },
] as const;

export function ParticipationRoleSelector() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activePathway = pathways[activeIdx];
  const { prefersReducedMotion } = usePublicMotionPreference();

  return (
    <section aria-label="Participation Roles" className={styles.rolesSection}>
      <div className={styles.roleTabsRow} role="tablist">
        {pathways.map((pathway, idx) => {
          const isSelected = idx === activeIdx;
          return (
            <button
              aria-selected={isSelected}
              className={`${styles.roleTabButton} ${
                isSelected ? styles.roleTabButtonActive : ""
              }`}
              key={pathway.id}
              onClick={() => setActiveIdx(idx)}
              role="tab"
              type="button"
            >
              {isSelected && !prefersReducedMotion && (
                <motion.div
                  className={styles.roleTabIndicator}
                  layoutId="activeRoleTabIndicator"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className={styles.roleTabTitle}>{pathway.title}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.roleStageCard}>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={styles.roleStageGrid}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
            key={activePathway.id}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <div className={styles.roleCopyColumn}>
              <div>
                <span
                  style={{
                    fontFamily: "var(--kt-font-mono, monospace)",
                    fontSize: "0.75rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--kt-signal-red, #cf2930)",
                    fontWeight: 600,
                    display: "inline-block",
                    marginBottom: 8,
                  }}
                >
                  {activePathway.badge}
                </span>
                <h2 className={styles.roleHeading}>{activePathway.title}</h2>
              </div>

              <p className={styles.roleTagline}>{activePathway.tagline}</p>

              <div className={styles.roleRequirementsBlock}>
                <h3 className={styles.requirementsTitle}>Onboarding Requirements</h3>
                <ul className={styles.requirementsList}>
                  {activePathway.requirements.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.roleActionRow}>
                <Link
                  className={styles.rolePrimaryAction}
                  data-kt-cursor="JOIN"
                  href={activePathway.action.href}
                >
                  <span>{activePathway.action.label}</span>
                  <KtIconArrowRight size={18} />
                </Link>
              </div>
            </div>

            <div className={styles.roleMediaColumn}>
              <Image
                alt={activePathway.media.alt}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 45vw"
                src={activePathway.media.src}
                style={{
                  objectFit: "cover",
                  objectPosition: activePathway.media.objectPosition ?? "center",
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

