"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import type { CinematicCategoryNode } from "@/lib/public-marketplace/category-navigation-model";
import { marketplaceCategoryHref, marketplaceHref } from "@/lib/public-marketplace/routes";
import { usePublicMotionPreference } from "@/components/public-v2/motion/usePublicMotionPreference";
import { CategoryOrbitSpinner } from "./CategoryOrbitSpinner";
import { CategoryFanDeck } from "./CategoryFanDeck";
import { SubcategoryAccordion } from "./SubcategoryAccordion";
import { CATEGORY_SPINNER_TIMING } from "./category-navigator-timing";
import styles from "./category-navigator.module.css";

export type CategoryNavigatorPhase = "intro-spin" | "major-categories" | "category-transition" | "subcategories" | "return-transition";
type TransitionStep = "centering" | "orbit" | "resolving";

export function CategoryAtlas({ categories }: { categories: readonly CinematicCategoryNode[] }) {
  const router = useRouter();
  const { prefersReducedMotion } = usePublicMotionPreference();
  const [phase, setPhase] = useState<CategoryNavigatorPhase>("intro-spin");
  const [introStep, setIntroStep] = useState<"spinning" | "resolving">("spinning");
  const [transitionStep, setTransitionStep] = useState<TransitionStep>("centering");
  const [returnStep, setReturnStep] = useState<"folding" | "orbit" | "resolving">("folding");
  const [activeMajorIndex, setActiveMajorIndex] = useState(0);
  const [selectedMajorIndex, setSelectedMajorIndex] = useState<number | null>(null);
  const [activeSubcategoryIndex, setActiveSubcategoryIndex] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileCardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const wheelDelta = useRef(0);
  const lastWheelStep = useRef(0);
  const suppressClick = useRef(false);
  const clickUnlockTimer = useRef<number | null>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => () => {
    if (clickUnlockTimer.current !== null) window.clearTimeout(clickUnlockTimer.current);
  }, []);

  // One director owns the finite scene timings and cleans them up on interruption/unmount.
  useEffect(() => {
    if (prefersReducedMotion && phase === "intro-spin") {
      const id = window.setTimeout(() => setPhase("major-categories"), 0);
      return () => window.clearTimeout(id);
    }
    if (phase === "intro-spin") {
      const resolve = window.setTimeout(() => setIntroStep("resolving"), isCompact ? CATEGORY_SPINNER_TIMING.compactIntroResolveMs : CATEGORY_SPINNER_TIMING.introSpinMs);
      const finish = window.setTimeout(() => setPhase("major-categories"), isCompact ? CATEGORY_SPINNER_TIMING.compactIntroFinishMs : CATEGORY_SPINNER_TIMING.introSpinMs + CATEGORY_SPINNER_TIMING.introResolveMs);
      return () => { window.clearTimeout(resolve); window.clearTimeout(finish); };
    }
    if (phase === "category-transition") {
      const orbit = window.setTimeout(() => setTransitionStep("orbit"), prefersReducedMotion ? 0 : isCompact ? CATEGORY_SPINNER_TIMING.compactSelectionCenterMs : CATEGORY_SPINNER_TIMING.selectionCenterMs);
      const resolve = !prefersReducedMotion && !isCompact
        ? window.setTimeout(() => setTransitionStep("resolving"), CATEGORY_SPINNER_TIMING.selectionCenterMs + CATEGORY_SPINNER_TIMING.selectionSpinMs)
        : null;
      const finish = window.setTimeout(() => {
        const parent = selectedMajorIndex === null ? null : categories[selectedMajorIndex];
        if (parent && parent.children.length === 0) router.push(marketplaceCategoryHref(parent.path) ?? marketplaceHref());
        else { setActiveSubcategoryIndex(0); setPhase("subcategories"); }
      }, prefersReducedMotion ? CATEGORY_SPINNER_TIMING.reducedSelectionFinishMs : isCompact ? CATEGORY_SPINNER_TIMING.compactSelectionFinishMs : CATEGORY_SPINNER_TIMING.selectionCenterMs + CATEGORY_SPINNER_TIMING.selectionSpinMs + CATEGORY_SPINNER_TIMING.selectionResolveMs);
      return () => { window.clearTimeout(orbit); if (resolve !== null) window.clearTimeout(resolve); window.clearTimeout(finish); };
    }
    if (phase === "return-transition") {
      const orbit = window.setTimeout(() => setReturnStep("orbit"), prefersReducedMotion ? 0 : isCompact ? CATEGORY_SPINNER_TIMING.compactReturnFoldMs : CATEGORY_SPINNER_TIMING.returnFoldMs);
      const resolve = !prefersReducedMotion && !isCompact
        ? window.setTimeout(() => setReturnStep("resolving"), CATEGORY_SPINNER_TIMING.returnFoldMs + CATEGORY_SPINNER_TIMING.returnSpinMs)
        : null;
      const finish = window.setTimeout(() => {
        restoreFocus.current = true;
        setSelectedMajorIndex(null);
        setPhase("major-categories");
      }, prefersReducedMotion ? CATEGORY_SPINNER_TIMING.reducedReturnFinishMs : isCompact ? CATEGORY_SPINNER_TIMING.compactReturnFinishMs : CATEGORY_SPINNER_TIMING.returnFoldMs + CATEGORY_SPINNER_TIMING.returnSpinMs + CATEGORY_SPINNER_TIMING.returnResolveMs);
      return () => { window.clearTimeout(orbit); if (resolve !== null) window.clearTimeout(resolve); window.clearTimeout(finish); };
    }
  }, [phase, prefersReducedMotion, isCompact, selectedMajorIndex, categories, router]);

  useEffect(() => {
    if (phase === "subcategories") headingRef.current?.focus({ preventScroll: true });
    if (phase === "major-categories" && restoreFocus.current) {
      restoreFocus.current = false;
      (isCompact ? mobileCardRefs.current[activeMajorIndex] : cardRefs.current[activeMajorIndex])?.focus({ preventScroll: true });
    }
  }, [phase, activeMajorIndex, isCompact]);

  if (categories.length === 0) {
    return <section className={styles.empty}><h1>Shop by category</h1><p>Categories are being prepared.</p><Link href={marketplaceHref()}>Return to shop →</Link></section>;
  }

  const interactive = phase === "major-categories" || (isCompact && phase === "intro-spin");
  const selectedMajor = selectedMajorIndex === null ? null : categories[selectedMajorIndex];
  const showOrbit = !prefersReducedMotion && !isCompact && (phase === "intro-spin" || (phase === "category-transition" && transitionStep !== "centering") || (phase === "return-transition" && returnStep !== "folding"));
  const darkScene = phase === "major-categories" || phase === "subcategories" || (phase === "intro-spin" && (isCompact || introStep === "resolving")) || (phase === "category-transition" && transitionStep === "centering");
  const showFan = phase === "major-categories" || phase === "category-transition" || (phase === "return-transition" && returnStep !== "folding") || (phase === "intro-spin" && (isCompact || introStep === "resolving"));

  function rotate(direction: number) {
    if (!interactive) return;
    setHasUserInteracted(true);
    setActiveMajorIndex((index) => (index + direction + categories.length) % categories.length);
  }

  function selectMajor(index: number) {
    if (!interactive || suppressClick.current) return;
    setHasUserInteracted(true);
    setActiveMajorIndex(index);
    setSelectedMajorIndex(index);
    setTransitionStep("centering");
    setPhase("category-transition");
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!interactive || isCompact) return;
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheelStep.current < 210) return;
    wheelDelta.current += event.deltaY;
    if (Math.abs(wheelDelta.current) < 55) return;
    rotate(Math.sign(wheelDelta.current));
    wheelDelta.current = 0;
    lastWheelStep.current = now;
  }

  function handleDragEnd(offset: number, velocity: number) {
    if (!interactive || (Math.abs(offset) < 55 && Math.abs(velocity) < 350)) return;
    suppressClick.current = true;
    if (clickUnlockTimer.current !== null) window.clearTimeout(clickUnlockTimer.current);
    clickUnlockTimer.current = window.setTimeout(() => { suppressClick.current = false; clickUnlockTimer.current = null; }, 100);
    rotate(offset < 0 || velocity < -350 ? 1 : -1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); rotate(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); rotate(1); }
    if (event.key === "Home") { event.preventDefault(); setActiveMajorIndex(0); }
    if (event.key === "End") { event.preventDefault(); setActiveMajorIndex(categories.length - 1); }
    if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault(); selectMajor(activeMajorIndex);
    }
  }

  return (
    <div className={styles.stage} onWheel={handleWheel} onKeyDown={handleKeyDown} data-phase={phase} data-user-interacted={hasUserInteracted}>
      <motion.div className={styles.carbonBackdrop} initial={false} animate={{ opacity: darkScene ? 1 : 0 }} transition={{ duration: prefersReducedMotion ? 0.15 : 0.45 }} />
      <div className={styles.stageContent}>
        <div className={`${styles.majorHeading} ${interactive ? styles.majorHeadingVisible : ""}`}>
          <span className={styles.eyebrow}>CATEGORIES / {String(activeMajorIndex + 1).padStart(2, "0")}—{String(categories.length).padStart(2, "0")}</span>
          <h1>Shop by category</h1>
        </div>
        {showOrbit && <CategoryOrbitSpinner key={`${phase}-${selectedMajorIndex}`} categories={categories} destinationIndex={selectedMajorIndex ?? 0} kind={phase === "intro-spin" ? "intro" : phase === "return-transition" ? "return" : "selection"} resolving={(phase === "intro-spin" && introStep === "resolving") || (phase === "category-transition" && transitionStep === "resolving") || (phase === "return-transition" && returnStep === "resolving")} />}
        {phase === "intro-spin" && !isCompact && !prefersReducedMotion && <button type="button" className={styles.skipIntro} onClick={() => { setHasUserInteracted(true); setPhase("major-categories"); }}>Skip animation →</button>}
        {showFan && (
          <div className={styles.majorScene} aria-hidden={!interactive}>
            <CategoryFanDeck categories={categories} activeIndex={activeMajorIndex} interactive={interactive} collapsed={(phase === "category-transition" && transitionStep !== "centering") || phase === "return-transition"} entering={phase === "intro-spin" && introStep === "resolving"} reducedMotion={prefersReducedMotion} cardRefs={cardRefs} mobileCardRefs={mobileCardRefs} onSelect={selectMajor} onActiveChange={setActiveMajorIndex} onDragEnd={handleDragEnd} />
            <div className={styles.deckControls}>
              <button type="button" onClick={() => rotate(-1)} disabled={!interactive} aria-label="Previous category">←</button>
              <span aria-live="polite">{String(activeMajorIndex + 1).padStart(2, "0")} / {String(categories.length).padStart(2, "0")}</span>
              <button type="button" onClick={() => rotate(1)} disabled={!interactive} aria-label="Next category">→</button>
            </div>
          </div>
        )}
        {(phase === "subcategories" || (phase === "return-transition" && returnStep === "folding")) && selectedMajor && (
          <motion.div className={styles.subcategoryTransition} initial={{ scaleX: prefersReducedMotion ? 1 : 0.2, opacity: prefersReducedMotion ? 1 : 0.25 }} animate={{ scaleX: phase === "return-transition" ? 0.2 : 1, opacity: phase === "return-transition" ? 0 : 1 }} transition={{ duration: prefersReducedMotion ? 0.1 : phase === "return-transition" ? 0.2 : 0.58, ease: [0.16, 1, 0.3, 1] }} style={{ pointerEvents: phase === "return-transition" ? "none" : "auto" }} aria-hidden={phase === "return-transition"} inert={phase === "return-transition"}>
            <SubcategoryAccordion parent={selectedMajor} activeIndex={activeSubcategoryIndex} onActiveChange={setActiveSubcategoryIndex} onReturn={() => { setReturnStep("folding"); setPhase("return-transition"); }} headingRef={headingRef} reducedMotion={prefersReducedMotion} />
          </motion.div>
        )}
      </div>
    </div>
  );
}
