"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./participation.module.css";

const pathways = [
  {
    id: "store",
    title: "Store Partners & Merchants",
    tagline: "Publish your catalog and fulfill local customer orders with authenticated courier dispatch.",
    requirements: [
      "Verified South African business or registered trade entity",
      "Configured merchant address within active collection corridors",
      "Catalog items suitable for standard courier transit",
    ],
    action: { label: "Create store account", href: "/signup?role=store" },
    media: homeMedia.merchantPrepare,
  },
  {
    id: "driver",
    title: "Driver & Courier Network",
    tagline: "Provide professional delivery handling across designated urban hubs and arterial routes.",
    requirements: [
      "Valid South African driver's licence and roadworthy vehicle",
      "Background verification and regional route familiarity",
      "Commitment to verified physical custody handoffs",
    ],
    action: { label: "Learn about driver network", href: "/services/driver-network" },
    media: homeMedia.handoff,
  },
  {
    id: "promoter",
    title: "Promoters & Ambassadors",
    tagline: "Introduce local merchants and customers to the KT marketplace and delivery network.",
    requirements: [
      "Active local business or community presence in active corridors",
      "Demonstrated alignment with verified commerce standards",
      "Account-based partner coordination with the KT team",
    ],
    action: { label: "Inquire about promoter partnership", href: "/contact" },
    media: homeMedia.worldMarket,
  },
] as const;

export function ParticipationRoleSelector() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activePathway = pathways[activeIdx];

  return (
    <section aria-label="Participation Roles" className={styles.rolesSection}>
      <div className={styles.roleTabsRow}>
        {pathways.map((pathway, idx) => {
          const isSelected = idx === activeIdx;
          return (
            <button
              className={`${styles.roleTabButton} ${
                isSelected ? styles.roleTabButtonActive : ""
              }`}
              key={pathway.id}
              onClick={() => setActiveIdx(idx)}
              type="button"
            >
              <span className={styles.roleTabTitle}>{pathway.title}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.roleStageCard}>
        <div className={styles.roleCopyColumn}>
          <h2 className={styles.roleHeading}>{activePathway.title}</h2>
          <p className={styles.roleTagline}>{activePathway.tagline}</p>

          <div className={styles.roleRequirementsBlock}>
            <h3 className={styles.requirementsTitle}>Participation Requirements</h3>
            <ul className={styles.requirementsList}>
              {activePathway.requirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>

          <div className={styles.roleActionRow}>
            <Link
              className={styles.rolePrimaryAction}
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
      </div>
    </section>
  );
}
