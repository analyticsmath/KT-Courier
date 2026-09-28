"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { CommerceSearchCommand } from "@/components/public-v2/commerce/CommerceSearchCommand";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import type { MarketplaceStore } from "./MarketplaceLanding";
import { circularRelative, selectCinemaStores } from "./store-cinema-selection";
import styles from "./store-cinema.module.css";

const mobileQuery = "(max-width: 767px)";
const subscribeMobile = (onChange: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getMobile = () => window.matchMedia(mobileQuery).matches;
const getServerMobile = () => false;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type StorePose = { x: number; scale: number; opacity: number; shade: number; depth: number };
const roles = [
  { relative: -3.5, x: -45, scale: .25, opacity: 0 },
  { relative: -3, x: -39, scale: .28, opacity: .48 },
  { relative: -2, x: -30, scale: .35, opacity: .72 },
  { relative: -1, x: -20, scale: .46, opacity: .9 },
  { relative: 0, x: 0, scale: 1, opacity: 1 },
  { relative: 1, x: 20, scale: .46, opacity: .9 },
  { relative: 2, x: 30, scale: .35, opacity: .72 },
  { relative: 3, x: 39, scale: .28, opacity: .48 },
  { relative: 3.5, x: 45, scale: .25, opacity: 0 },
] as const;

function rolePose(relative: number): StorePose {
  const r = clamp(relative, -3.5, 3.5);
  const right = Math.min(roles.length - 1, Math.max(1, roles.findIndex((role) => role.relative >= r)));
  const before = roles[right - 1]!;
  const after = roles[right]!;
  const mix = after.relative === before.relative ? 0 : (r - before.relative) / (after.relative - before.relative);
  const interpolate = (key: "x" | "scale" | "opacity") => before[key] + (after[key] - before[key]) * mix;
  const distance = Math.abs(relative);
  return {
    x: interpolate("x"), scale: interpolate("scale"), opacity: interpolate("opacity"),
    shade: clamp(distance * .18, 0, .3),
    depth: Math.round(100 - distance * 12),
  };
}

function storeImage(store: MarketplaceStore) {
  return store.heroMediaReference ? `/api/catalog/media/${store.heroMediaReference}` : homeMedia.merchantPrepare.src;
}

function CinemaPanel({ store, index, count, storeFloat, preload }: {
  store: MarketplaceStore; index: number; count: number; storeFloat: MotionValue<number>; preload: boolean;
}) {
  const relative = useTransform(storeFloat, (value) => circularRelative(index, value, count));
  const pose = useTransform(relative, rolePose);
  const x = useTransform(pose, (value) => `calc(${value.x}vw - 50%)`);
  const scale = useTransform(pose, (value) => value.scale);
  const opacity = useTransform(pose, (value) => value.opacity);
  const zIndex = useTransform(pose, (value) => value.depth);
  const shade = useTransform(pose, (value) => value.shade);
  return <motion.article className={styles.panel} style={{ x, y: "-50%", scale, opacity, zIndex }} aria-hidden="true">
    <Image alt="" fill preload={preload} sizes="(max-width: 1199px) 44vw, 600px" src={storeImage(store)} className={styles.panelImage} />
    <motion.span className={styles.panelShade} style={{ opacity: shade }} aria-hidden="true" />
  </motion.article>;
}

export function StoreCinema({ stores, mode, query = "" }: {
  stores: readonly MarketplaceStore[]; mode: "featured" | "directory"; query?: string;
}) {
  const featured = selectCinemaStores(stores, mode);
  const sceneRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const [active, setActive] = useState(0);
  const mobile = useSyncExternalStore(subscribeMobile, getMobile, getServerMobile);
  const reducedMotion = useReducedMotion();
  const native = mobile || Boolean(reducedMotion);
  const { scrollYProgress } = useScroll({ target: sceneRef, offset: ["start start", "end end"] });
  const storeFloat = useTransform(scrollYProgress, (progress) => progress * Math.max(0, featured.length - 1));
  useMotionValueEvent(storeFloat, "change", (value) => {
    if (native) return;
    const next = clamp(Math.round(value), 0, Math.max(0, featured.length - 1));
    setActive((current) => current === next ? current : next);
  });
  useEffect(() => () => { if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); }, []);

  const sceneVh = Math.min(mode === "directory" ? 700 : 520, 120 + Math.max(0, featured.length - 1) * 62);
  const activeStore = featured[active] ?? featured[0];

  function scrollToStore(index: number) {
    if (!featured.length) return;
    const target = clamp(index, 0, featured.length - 1);
    if (native) {
      railRef.current?.children[target]?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
      setActive(target);
      return;
    }
    const scene = sceneRef.current;
    if (!scene) return;
    const start = window.scrollY + scene.getBoundingClientRect().top;
    const range = Math.max(0, scene.offsetHeight - window.innerHeight);
    window.scrollTo({ top: start + range * (featured.length <= 1 ? 0 : target / (featured.length - 1)), behavior: "smooth" });
  }

  function onNativeScroll() {
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const rail = railRef.current;
      const first = rail?.firstElementChild as HTMLElement | null;
      if (!rail || !first) return;
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
      const next = clamp(Math.round(rail.scrollLeft / (first.offsetWidth + gap)), 0, featured.length - 1);
      setActive((current) => current === next ? current : next);
    });
  }

  if (!featured.length) return <section className={styles.emptyScene} ref={sceneRef} aria-labelledby="store-empty-title">
    <div className={styles.emptyTop}><span>{mode === "directory" ? "STORES" : "INDEPENDENT STOREFRONTS"}</span>{mode === "directory" && <div className={styles.cinemaSearch}><CommerceSearchCommand action={marketplaceStoresHref()} appearance="cinema" placeholder="Search storefronts" query={query} /></div>}</div>
    <h1 id="store-empty-title">{mode === "directory" ? "No matching storefronts" : "Storefronts are coming soon"}</h1>
    <p>{mode === "directory" ? "Try another search or browse all storefronts." : "Discover more from the marketplace."}</p>
    <Link href={mode === "directory" ? marketplaceStoresHref() : "/shop/search"}>{mode === "directory" ? "Clear search →" : "Explore products →"}</Link>
  </section>;

  return <section className={styles.scene} ref={sceneRef} style={{ "--scene-scroll-height": `${sceneVh}svh` } as React.CSSProperties} aria-label={mode === "featured" ? "Featured storefronts" : "Store directory"} onKeyDown={(event) => {
    if (event.target instanceof HTMLElement && event.target.closest("form")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToStore(active + (event.key === "ArrowRight" ? 1 : -1));
    }
  }} tabIndex={0}>
    <div className={styles.sticky}>
      <div className={styles.topRow}>
        <span className={styles.marker}>{mode === "featured" ? "INDEPENDENT STOREFRONTS" : "STORES"}</span>
        {mode === "directory" && <div className={styles.cinemaSearch}><CommerceSearchCommand action={marketplaceStoresHref()} appearance="cinema" placeholder="Search storefronts" query={query} /></div>}
        <div className={styles.topRight}><span>{String(active + 1).padStart(2, "0")} / {String(featured.length).padStart(2, "0")}</span>{mode === "featured" && <Link href={marketplaceStoresHref()}>All storefronts →</Link>}</div>
      </div>
      <div className={`${styles.editorialTitle} ${mode === "directory" ? styles.directoryTitle : ""}`} aria-live="polite"><AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={activeStore.reference} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .38, ease: [0.22, 1, .36, 1] }}>
          {mode === "directory" ? <h1>{activeStore.name}</h1> : <h2>{activeStore.name}</h2>}
        </motion.div>
      </AnimatePresence></div>
      <div className={styles.belt} aria-hidden={native} inert={native}>
        {featured.map((store, index) => <CinemaPanel key={store.reference} store={store} index={index} count={featured.length} storeFloat={storeFloat} preload={index < 3 && !native} />)}
      </div>
      <div className={styles.focusAperture}>
        <span className={styles.focusOutline} aria-hidden="true" />
        {marketplaceStoreHref(activeStore.slug) && <Link className={styles.focusLink} href={marketplaceStoreHref(activeStore.slug)!} aria-label={`Visit ${activeStore.name}`}>
          <span className={styles.focusInfo}>
            {activeStore.logoMediaReference && <span className={styles.focusLogo}><Image alt="" fill sizes="40px" src={`/api/catalog/media/${activeStore.logoMediaReference}`} /></span>}
            <span className={styles.focusDetails}><strong>{activeStore.publishedOfferCount} published products</strong>{activeStore.description && <small>{activeStore.description}</small>}</span>
            <span className={styles.visit}>Visit store →</span>
          </span>
        </Link>}
      </div>
      <div className={styles.nativeRail} ref={railRef} onScroll={onNativeScroll} aria-label="Storefronts">
        {featured.map((store, index) => {
          const href = marketplaceStoreHref(store.slug);
          return <article className={`${styles.nativeCard} ${index === active ? styles.nativeCardActive : ""}`} key={store.reference}>
            {href && <Link href={href} aria-label={`Visit ${store.name}`}>
              <Image alt="" fill preload={index < 2 && native} sizes="(max-width: 767px) 86vw, 420px" src={storeImage(store)} />
              <span className={styles.nativeInfo}><strong>{store.publishedOfferCount} published products</strong>{store.description && <small>{store.description}</small>}<span>Visit store →</span></span>
            </Link>}
          </article>;
        })}
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.storeControls}><button type="button" aria-label={`Show ${featured[active - 1]?.name ?? "previous storefront"}`} disabled={active === 0} onClick={() => scrollToStore(active - 1)}>←</button><button type="button" aria-label={`Show ${featured[active + 1]?.name ?? "next storefront"}`} disabled={active === featured.length - 1} onClick={() => scrollToStore(active + 1)}>→</button></div>
        <div className={styles.scrollCue}><span className={styles.scrollCircle} aria-hidden="true">⌄</span><span>{native ? "SWIPE TO EXPLORE" : "SCROLL TO CONTINUE"}</span></div>
      </div>
    </div>
  </section>;
}
