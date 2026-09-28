import { useEffect, useRef, type RefObject, type UIEvent } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import type { CinematicCategoryNode } from "@/lib/public-marketplace/category-navigation-model";
import { categoryFanPose, wrappedCategoryDelta } from "./category-navigator-geometry";
import { majorCategoryMedia } from "./category-navigator-media";
import styles from "./category-navigator.module.css";

export function CategoryFanDeck({ categories, activeIndex, interactive, collapsed, entering, reducedMotion, cardRefs, mobileCardRefs, onSelect, onActiveChange, onDragEnd }: {
  categories: readonly CinematicCategoryNode[];
  activeIndex: number;
  interactive: boolean;
  collapsed: boolean;
  entering: boolean;
  reducedMotion: boolean;
  cardRefs: RefObject<Array<HTMLButtonElement | null>>;
  mobileCardRefs: RefObject<Array<HTMLButtonElement | null>>;
  onSelect: (index: number) => void;
  onActiveChange: (index: number) => void;
  onDragEnd: (offset: number, velocity: number) => void;
}) {
  const mobileDeckRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const deck = mobileDeckRef.current;
    const card = mobileCardRefs.current[activeIndex];
    if (!deck || !card || window.matchMedia("(min-width: 1024px)").matches) return;
    const targetLeft = card.offsetLeft - deck.offsetLeft - (deck.clientWidth - card.clientWidth) / 2;
    if (Math.abs(deck.scrollLeft - targetLeft) > 40) deck.scrollTo({ left: targetLeft, behavior: reducedMotion ? "instant" : "smooth" });
  }, [activeIndex, mobileCardRefs, reducedMotion]);

  function handleMobileScroll(event: UIEvent<HTMLDivElement>) {
    if (!interactive) return;
    const deck = event.currentTarget;
    const center = deck.getBoundingClientRect().left + deck.clientWidth / 2;
    let nearest = activeIndex;
    let distance = Infinity;
    mobileCardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const next = Math.abs(rect.left + rect.width / 2 - center);
      if (next < distance) { nearest = index; distance = next; }
    });
    if (nearest !== activeIndex) onActiveChange(nearest);
  }

  return (
    <>
      <motion.div className={styles.fanField} drag={interactive ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08} onDragEnd={(_, info) => onDragEnd(info.offset.x, info.velocity.x)}>
        {categories.map((category, index) => {
          const delta = wrappedCategoryDelta(index, activeIndex, categories.length);
          const pose = categoryFanPose(delta, reducedMotion);
          return (
            <motion.button
              type="button"
              className={styles.fanCard}
              key={category.reference}
              ref={(element) => { cardRefs.current[index] = element; }}
              aria-label={`Open ${category.name} subcategories`}
              aria-current={delta === 0 ? "true" : undefined}
              disabled={!interactive}
              onFocus={() => onActiveChange(index)}
              onClick={() => onSelect(index)}
              initial={entering ? { x: 0, rotateY: 0, z: -100, scale: 0.35, opacity: 0 } : false}
              animate={collapsed ? { x: 0, rotateY: 0, z: -100, scale: 0.5, opacity: 0 } : pose}
              transition={{ type: "spring", stiffness: 170, damping: 24, mass: 0.75 }}
              style={{ zIndex: categories.length - Math.abs(delta) }}
            >
              <Image alt="" fill priority sizes="(min-width: 1024px) 320px, 85vw" src={majorCategoryMedia(category)} className={styles.image} />
              <span className={styles.imageShade} />
              <span className={styles.fanCopy}>
                <span className={styles.cardOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.cardTitle}>{category.name}</span>
                {delta === 0 && category.description && <span className={styles.cardDescription}>{category.description}</span>}
                {delta === 0 && Boolean(category.productCount && category.productCount > 0) && <span className={styles.cardCount}>{category.productCount} products</span>}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
      <motion.div className={styles.mobileDeck} aria-label="Major categories" ref={mobileDeckRef} onScroll={handleMobileScroll} initial={reducedMotion ? false : { opacity: 0.55, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}>
        {categories.map((category, index) => (
          <button type="button" key={category.reference} ref={(element) => { mobileCardRefs.current[index] = element; }} disabled={!interactive} className={styles.mobileCard} onClick={() => onSelect(index)} aria-label={`Open ${category.name} subcategories`}>
            <Image alt="" fill priority sizes="85vw" src={majorCategoryMedia(category)} className={styles.image} />
            <span className={styles.imageShade} />
            <span className={styles.mobileCardTitle}>{category.name}</span>
          </button>
        ))}
      </motion.div>
    </>
  );
}
