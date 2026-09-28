import Image from "next/image";
import { motion } from "motion/react";
import type { CinematicCategoryNode } from "@/lib/public-marketplace/category-navigation-model";
import { majorCategoryMedia } from "./category-navigator-media";
import styles from "./category-navigator.module.css";

export function CategoryOrbitSpinner({ categories, destinationIndex, kind, resolving = false }: {
  categories: readonly CinematicCategoryNode[];
  destinationIndex: number;
  kind: "intro" | "selection" | "return";
  resolving?: boolean;
}) {
  const angleStep = 360 / categories.length;
  const targetRotation = kind === "intro" ? 720 : kind === "selection" ? 360 - destinationIndex * angleStep : -360 - destinationIndex * angleStep;
  return (
    <div className={styles.orbitStage} aria-hidden="true">
      <motion.div
        className={styles.orbitRing}
        initial={{ rotateY: kind === "selection" ? -destinationIndex * angleStep : 0, scale: kind === "return" ? 0.45 : 1 }}
        animate={{ rotateY: targetRotation, scale: kind === "intro" && resolving ? 0.35 : kind === "return" ? 1 : kind === "selection" ? 0.58 : 1, opacity: kind === "intro" && resolving ? 0 : 1 }}
        transition={{ duration: kind === "intro" ? resolving ? 0.4 : 1.95 : kind === "return" ? 0.72 : 1.08, ease: [0.16, 0.78, 0.24, 1] }}
      >
        {categories.map((category, index) => (
          <div
            className={styles.orbitCard}
            key={category.reference}
            style={{ transform: `rotateY(${index * angleStep}deg) translateZ(var(--orbit-radius))` }}
          >
            <Image alt="" fill priority sizes="(min-width: 1024px) 260px, 180px" src={majorCategoryMedia(category)} className={styles.image} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
