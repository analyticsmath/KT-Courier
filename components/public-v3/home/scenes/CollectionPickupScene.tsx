"use client";

import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../home-cinematic.module.css";

export function CollectionPickupScene() {
  return <section className={`${styles.chapter} ${styles.pickup}`} data-kt-scene="pickup" data-home-film aria-labelledby="cinematic-pickup-heading" style={{ "--film-budget": `${chapterBudgetVh("pickup")}svh`, "--film-mobile-budget": `${mobileChapterBudgetVh("pickup")}svh` } as React.CSSProperties}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.pickupCopy} data-cinematic-pickup-copy><p className={styles.eyebrow}>Collection / 03</p><h2 id="cinematic-pickup-heading" className={styles.giant}><span data-pickup-word="packed">Packed.</span><span data-pickup-word="collected">Collected.</span></h2></div><span className={styles.pickupGround} aria-hidden="true" /></div>
  </section>;
}
