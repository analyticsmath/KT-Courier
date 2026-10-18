"use client";

import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../home-cinematic.module.css";

export function CollectionPickupScene() {
  return <section className={`${styles.chapter} ${styles.pickup}`} data-kt-scene="pickup" data-home-film aria-labelledby="cinematic-pickup-heading" style={{ "--film-budget": `${chapterBudgetVh("pickup")}svh`, "--film-mobile-budget": `${mobileChapterBudgetVh("pickup")}svh` } as React.CSSProperties}>
    <div className={styles.sticky} data-home-sticky-stage><div className={styles.pickupCopy} data-cinematic-pickup-copy><h2 id="cinematic-pickup-heading" className={styles.giant}><span data-pickup-word="packed">Picked up.</span><span data-pickup-word="collected">On the move.</span></h2></div><span className={styles.pickupGround} aria-hidden="true" /></div>
  </section>;
}
