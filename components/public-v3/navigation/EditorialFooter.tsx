"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./editorial-footer.module.css";

const groups = [
  { title: "Move", links: [["Send a parcel", "/services/parcel"], ["All services", "/services"], ["Get a quote", "/quote"], ["Track delivery", "/track"], ["Freight", "/services/freight"]] },
  { title: "Discover", links: [["Marketplace", "/shop"], ["Local stores", "/shop/stores"], ["Our coverage", "/coverage-areas"], ["Join the network", "/join"], ["Careers", "/careers"]] },
  { title: "KT Couriers", links: [["Contact", "/contact"], ["Help & questions", "/faq"], ["Safety", "/safety"], ["Privacy", "/privacy-policy"], ["Terms", "/terms"], ["Accessibility", "/accessibility"]] },
] as const;

export function EditorialFooter() {
  const root = useRef<HTMLElement>(null);
  const actor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current || !actor.current || window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 900px)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(actor.current, { x: -90 }, { x: 0, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "top 20%", scrub: .65, invalidateOnRefresh: true } });
    }, root);
    return () => ctx.revert();
  }, []);

  return <footer ref={root} className={styles.footer} role="contentinfo">
    <section className={styles.threshold} aria-label="Make your next move">
      <div className={styles.inner}>
        <div className={styles.statement}>
          <h2>Something to send?<span>We move it.</span></h2>
          <p className={styles.intro}>From the first collection to the final handoff, KT connects local shopping and real-world delivery. Your next journey starts here.</p>
        </div>
        <div className={styles.actions}>
          <Link href="/quote" className={`${styles.action} ${styles.actionPrimary}`}>Get a delivery quote <span aria-hidden="true">&nbsp;↗</span></Link>
          <Link href="/track" className={`${styles.action} ${styles.actionSecondary}`}>Track a delivery <span aria-hidden="true">&nbsp;↗</span></Link>
        </div>
        <div ref={actor} className={styles.actor} aria-hidden="true">
          <Image src="/media/public/protagonists/protagonist-van-side-right.webp" alt="" width={1152} height={648} sizes="(max-width: 600px) 88vw, 490px" loading="lazy" />
        </div>
      </div>
    </section>
    <div className={styles.directory}>
      <div className={styles.inner}>
        <div className={styles.directoryTop}>
          <div className={styles.brand}>
            <span className={styles.brandTitle}>KT COURIERS</span>
            <p>Shop local. Send with KT. Connecting stores, people and the places in between.</p>
          </div>
          {groups.map(group => <nav key={group.title} className={styles.links} aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.links.map(([name, path]) => <li key={path}><Link href={path}>{name}</Link></li>)}</ul>
          </nav>)}
        </div>
        <div className={styles.bottom}>
          <span>© {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.</span>
          <span><Link href="/refund-policy">Refunds</Link> &nbsp;·&nbsp; <Link href="/shipping-policy">Shipping</Link></span>
          <span>Made by Valtum Studio</span>
        </div>
      </div>
    </div>
  </footer>;
}
