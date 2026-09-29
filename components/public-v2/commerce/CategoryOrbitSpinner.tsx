import Image from "next/image";
import { motion } from "motion/react";
import type { CinematicCategoryNode } from "@/lib/public-marketplace/category-navigation-model";
import { majorCategoryMedia } from "./category-navigator-media";
import { CATEGORY_SPINNER_TIMING } from "./category-navigator-timing";
import { categoryOrbitAngle } from "./category-orbit-geometry";
import styles from "./category-navigator.module.css";

export function CategoryOrbitSpinner({ categories, destinationIndex, kind, resolving = false }: {
  categories: readonly CinematicCategoryNode[];
  destinationIndex: number;
  kind: "intro" | "selection" | "return";
  resolving?: boolean;
}) {
  const angleStep = 360 / categories.length;
  const selectedFrontRotation = -destinationIndex * angleStep;
  const startRotation = kind === "intro" ? 0 : selectedFrontRotation;
  const endRotation = kind === "intro" ? 360 : kind === "selection" ? selectedFrontRotation + 360 : selectedFrontRotation - 360;
  const spinMs = kind === "intro" ? CATEGORY_SPINNER_TIMING.introSpinMs : kind === "selection" ? CATEGORY_SPINNER_TIMING.selectionSpinMs : CATEGORY_SPINNER_TIMING.returnSpinMs;
  const resolveMs = kind === "intro" ? CATEGORY_SPINNER_TIMING.introResolveMs : kind === "selection" ? CATEGORY_SPINNER_TIMING.selectionResolveMs : CATEGORY_SPINNER_TIMING.returnResolveMs;
  return (
    <div className={styles.orbitStage} aria-hidden="true">
      <div className={styles.orbitViewport}>
        <div className={styles.orbitRig}>
          <motion.div
            className={styles.orbitRing}
            initial={{ rotateY: startRotation, scale: kind === "return" ? 0.42 : 1, z: kind === "return" ? -120 : 0 }}
            animate={{ rotateY: endRotation, scale: resolving ? 0.42 : 1, z: resolving ? -120 : 0 }}
            transition={{ duration: (resolving ? resolveMs : spinMs) / 1000, ease: [0.22, 0.68, 0.18, 1] }}
          >
            {categories.map((category, index) => {
              const media = majorCategoryMedia(category);
              return (
                <div
                  className={styles.orbitCard}
                  key={category.reference}
                  style={{ transform: `rotateY(${categoryOrbitAngle(index, categories.length)}deg) translateZ(var(--orbit-radius))` }}
                >
                  <div className={`${styles.orbitFace} ${styles.orbitFaceFront}`}>
                    <Image alt="" fill priority sizes="(min-width: 1024px) 220px, 176px" src={media} className={styles.image} />
                  </div>
                  <div className={`${styles.orbitFace} ${styles.orbitFaceBack}`}>
                    <Image alt="" fill priority sizes="(min-width: 1024px) 220px, 176px" src={media} className={styles.image} />
                    <span className={styles.orbitRearShade} />
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
