"use client";

import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import { SplitVignette } from "@/components/public-v2/motion/transitions/SplitVignette";
import styles from "./home-journey.module.css";

export function HandoffScene() {
  const courierHandoff = ktMedia.home.courier.readyHandover;
  const merchantDetail = ktMedia.documentary.handoffDetail;

  return (
    <section
      aria-labelledby="handoff-heading"
      className={styles.handoffCustodyScene}
      data-scene="handoff"
    >
      <div className={styles.handoffContainer}>
        {/* Editorial Heading Block */}
        <div className={styles.handoffHeader} data-actor="handoff-copy">
          <span className={styles.handoffChapterTag}>
            STATE 10 — CUSTODY HANDOFF
          </span>
          <h2 className={styles.handoffHeadline} id="handoff-heading">
            Responsibility Changes Hands
          </h2>
          <p className={styles.handoffLead}>
            The parcel physically transfers to courier custody. Verified OTP confirmation establishes chain-of-custody for transit.
          </p>
        </div>

        {/* Compulsory Technique: Split Vignette Effect for Merchant → Courier Handoff */}
        <div className={styles.handoffSplitVignetteWrap} data-actor="handoff-frame">
          <SplitVignette
            leftLabel="MERCHANT TRANSFER"
            rightLabel="COURIER CUSTODY"
            className="h-[460px] md:h-[560px] border border-[var(--kt-public-border-subtle)]/40 rounded-[4px]"
            leftContent={
              <div className="relative w-full h-full bg-[var(--kt-public-interactive)]">
                <Image
                  alt={merchantDetail.alt}
                  src={merchantDetail.src}
                  fill
                  priority
                  sizes="(max-width: 1023px) 100vw, 800px"
                  className="object-cover brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-public-surface-inverse)]/80 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 z-20 px-2 py-0.5 bg-[var(--kt-public-surface-inverse)]/80 border border-[var(--kt-public-border-subtle)]/30 text-[10px] font-mono tracking-widest text-[var(--kt-public-text-inverse)] uppercase">
                  MERCHANT ORIGIN · PARCEL SEALED
                </div>
              </div>
            }
            rightContent={
              <div className="relative w-full h-full bg-[var(--kt-public-surface-inverse)]">
                <Image
                  alt={courierHandoff.alt}
                  src={courierHandoff.src}
                  fill
                  priority
                  sizes="(max-width: 1023px) 100vw, 800px"
                  className="object-contain object-bottom"
                />
                <div className="absolute top-4 right-4 z-20 px-2 py-0.5 bg-[var(--kt-public-interactive)] text-[10px] font-mono tracking-widest text-[var(--kt-public-text-inverse)] uppercase font-semibold">
                  COURIER ACCEPTED · OTP VERIFIED
                </div>
              </div>
            }
          />
        </div>

        {/* Minimal verified OTP evidence bar (Not a fake dashboard) */}
        <div className={styles.handoffEvidenceBar}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--kt-state-success)]" />
            <span className="text-[11px] font-mono tracking-wider text-[var(--kt-public-interactive-text)] uppercase">
              OTP VERIFIED HANDOFF
            </span>
          </div>
          <span className="text-[var(--kt-public-text-muted)] font-mono text-[11px]">
            TRANSFER ID #KT-7829-ZA
          </span>
          <span className="text-[11px] font-mono text-[var(--kt-public-interactive-text)]">
            CORRIDOR: JHB-SANDTON-EXPRESS
          </span>
        </div>
      </div>
    </section>
  );
}
