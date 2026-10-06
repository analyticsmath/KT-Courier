"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { shopCategoryMedia } from "./shop-category-media";
import type { MarketplaceCategory } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

export function ShopCategoryFilm({ categories }: { categories: readonly MarketplaceCategory[] }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open || !categories.length) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const step = isMobile ? 520 : 690;
    const timers = reduceMotion ? [] : categories.slice(1).map((_, i) => window.setTimeout(() => setIndex(i + 1), 450 + i * step));
    if (!reduceMotion) timers.push(window.setTimeout(() => setOpen(false), isMobile ? 2900 : 4750));
    const exit = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") exit(); };
    window.addEventListener("wheel", exit, { passive: true });
    window.addEventListener("touchmove", exit, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", exit, { passive: true });
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener("wheel", exit);
      window.removeEventListener("touchmove", exit);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", exit);
    };
  }, [categories, reduceMotion, open]);
  const category = categories[index];
  if (!category || !open) return null;
  const src = shopCategoryMedia(category);
  return <div className={styles.film} aria-label="Shop category introduction">
    <div className={styles.filmImagePlane}><AnimatePresence initial={false}>
      <motion.div key={category.reference} className={styles.filmImage} initial={{ y: "14%", scale: .985, opacity: .94 }} animate={{ y: "0%", scale: 1, opacity: 1 }} exit={{ y: "-10%", scale: 1.025, opacity: .94 }} transition={{ duration: reduceMotion ? 0 : .48, ease: [0.22, 1, 0.36, 1] }}>
        {src && <Image alt="" fill preload={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(max-width: 767px) 100vw, 50vw" src={src} />}
      </motion.div>
    </AnimatePresence></div>
    <div className={styles.filmTypePlane}><span className={styles.filmEyebrow}>KT MARKETPLACE</span><AnimatePresence initial={false}>
      <motion.div key={category.reference} className={styles.filmTitleGroup} initial={{ y: 46, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -42, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .36, delay: reduceMotion ? 0 : .07 }}>
        <span className={styles.filmOrdinal}>{String(index + 1).padStart(2, "0")} / {String(categories.length).padStart(2, "0")}</span>
        <div className={styles.filmTitle}>{category.name}</div>
      </motion.div>
    </AnimatePresence></div>
    {reduceMotion && <button className={styles.filmNext} type="button" onClick={() => setIndex((current) => (current + 1) % categories.length)}>Next category →</button>}
    <button className={styles.filmSkip} type="button" onClick={() => setOpen(false)}>Skip intro <span aria-hidden="true">→</span></button>
  </div>;
}
