"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { marketplaceStoreHref, marketplaceStoresHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "@/components/public-v2/home/home-media";
import type { MarketplaceStore } from "./MarketplaceLanding";
import styles from "./shop-flagship.module.css";

const subscribeMobile = (onChange: () => void) => {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getMobile = () => window.matchMedia("(max-width: 767px)").matches;
const getServerMobile = () => false;

export function StorefrontStack({ stores }: { stores: readonly MarketplaceStore[] }) {
  const featured = [...stores].sort((a, b) => b.publishedOfferCount - a.publishedOfferCount || a.name.localeCompare(b.name)).slice(0, 5);
  const stage = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const mobile = useSyncExternalStore(subscribeMobile, getMobile, getServerMobile);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (featured.length > 1) setActive(Math.min(featured.length - 1, Math.round(progress * (featured.length - 1))));
  });
  if (!featured.length) return null;
  return <section className={styles.storeSection} ref={stage} style={{ "--store-scroll-height": `${100 + (featured.length - 1) * 42}svh` } as React.CSSProperties} aria-labelledby="stores-heading">
    <div className={styles.storeSticky}><div className={styles.storeHeader}><div><span className={styles.sectionEyebrow}>LOCAL WORLDS</span><h2 id="stores-heading">Independent storefronts</h2></div><Link href={marketplaceStoresHref()}>All storefronts →</Link></div>
      <div className={styles.storeStage}>
        {featured.map((store, index) => {
          const href = marketplaceStoreHref(store.slug);
          const distance = index - active;
          const isActive = index === active;
          const src = store.heroMediaReference ? `/api/catalog/media/${store.heroMediaReference}` : homeMedia.merchantPrepare.src;
          return <motion.article className={styles.storeCard} key={store.reference} animate={reduceMotion ? {} : { x: distance < 0 ? -70 : distance > 0 ? 70 : 0, y: distance < 0 ? -22 : distance > 0 ? 26 : 0, scale: isActive ? 1 : Math.abs(distance) > 1 ? .86 : distance < 0 ? .92 : .94, rotateZ: isActive ? 0 : distance < 0 ? -2 : 2, opacity: isActive ? 1 : Math.abs(distance) > 1 ? .28 : distance < 0 ? .55 : .7 }} transition={{ duration: .5, ease: [0.22, 1, .36, 1] }} style={{ zIndex: featured.length - Math.abs(distance), pointerEvents: mobile || isActive ? "auto" : "none" }} aria-hidden={!mobile && !isActive} inert={!mobile && !isActive}>
            {href ? <Link className={styles.storeCardLink} href={href} tabIndex={mobile || isActive ? 0 : -1}>
              <span className={styles.storeImage}><Image alt="" fill sizes="(max-width: 767px) 84vw, 760px" src={src} /></span>
              <span className={styles.storeCardCopy}><span className={styles.storeIdentity}>{store.logoMediaReference && <span className={styles.storeLogo}><Image alt="" fill sizes="44px" src={`/api/catalog/media/${store.logoMediaReference}`} /></span>}<span><strong>{store.name}</strong><small>{store.publishedOfferCount} published products</small></span></span><span>Visit store →</span></span>
            </Link> : null}
          </motion.article>;
        })}
      </div><span className={styles.storeCount}>{String(active + 1).padStart(2, "0")} / {String(featured.length).padStart(2, "0")}</span>
    </div>
  </section>;
}
