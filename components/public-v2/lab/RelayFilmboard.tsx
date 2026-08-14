"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import styles from "./relay-filmboard.module.css";

type FrameId = "h0" | "h1" | "h2" | "h3" | "h4" | "h5";
type ReviewWidth = "desktop" | "mobile";

const frames: ReadonlyArray<{ id: FrameId; label: string; verb: string }> = [
  { id: "h0", label: "WORLD", verb: "H0" },
  { id: "h1", label: "ENTER", verb: "H1" },
  { id: "h2", label: "CHOICE", verb: "H2" },
  { id: "h3", label: "PREPARE", verb: "H3" },
  { id: "h4", label: "TRANSFER", verb: "H4" },
  { id: "h5", label: "RELEASE", verb: "H5" },
];

const media = {
  h0a: "/images/kt-couriers/relay/relay-h0-rosebank-market.webp",
  h0b: "/images/kt-couriers/relay/options/h0-b-market-aisle.jpg",
  h1: "/images/kt-couriers/relay/relay-h1-threshold.webp",
  h2a: "/images/kt-couriers/relay/relay-h2-choice.webp",
  h2b: "/images/kt-couriers/relay/options/h2-b-woman-buying-flowers.jpg",
  h2c: "/images/kt-couriers/relay/options/h2-c-women-selecting-flowers.jpg",
  h3: "/images/kt-couriers/relay/relay-h3-preparation.webp",
  h3alt: "/images/kt-couriers/relay/options/h3-alt-arranging-bouquet.jpg",
  h4: "/images/kt-couriers/relay/relay-h4-handoff.webp",
} as const;

const mediaSources = {
  h0b: "https://unsplash.com/photos/people-walking-through-a-busy-market-aisle-fKdUakd75kU",
  h2b: "https://www.pexels.com/photo/woman-buying-flowers-in-floral-shop-6097858/",
  h2c: "https://www.pexels.com/photo/women-picking-flowers-from-a-flower-shop-in-a-city-5047068/",
  h3alt: "https://www.pexels.com/photo/person-arranging-a-bouquet-of-flowers-6764313/",
} as const;

function FrameNumber({ id, verb }: { id: FrameId; verb: string }) {
  return <p className={styles.frameNumber}>{id.toUpperCase()} / {verb}</p>;
}

function ReviewImage({ src, alt, className, sizes = "(max-width: 767px) 100vw, 50vw" }: { src: string; alt: string; className?: string; sizes?: string }) {
  return <Image alt={alt} className={className} fill sizes={sizes} src={src} />;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className={styles.sectionHeading}>
    <p className={styles.sectionEyebrow}>{eyebrow}</p>
    <h2>{title}</h2>
    <p>{detail}</p>
  </div>;
}

function SheetCard({ label, note, children, className }: { label: string; note?: string; children: ReactNode; className?: string }) {
  return <article className={`${styles.sheetCard} ${className ?? ""}`}>
    <div className={styles.sheetLabel}><span>{label}</span>{note ? <small>{note}</small> : null}</div>
    {children}
  </article>;
}

function H0Card({ variant, width }: { variant: "a" | "b"; width: ReviewWidth }) {
  const source = variant === "a" ? media.h0a : media.h0b;
  return <div className={`${styles.sceneCard} ${width === "mobile" ? styles.sceneCardMobile : styles.sceneCardDesktop} ${variant === "a" ? styles.h0a : styles.h0b}`}>
    <ReviewImage src={source} alt={variant === "a" ? "Busy indoor market with independent stalls and shoppers" : "People walking through a busy market aisle with food and retail displays"} className={styles.sceneImage} sizes={width === "mobile" ? "390px" : "(max-width: 767px) 100vw, 50vw"} />
    <header className={styles.sceneHeader}>
      <Image alt="KT Couriers" className={styles.logo} height={30} src="/images/kt-couriers/brand/logo.svg" width={110} />
      <nav aria-label={`KT Couriers ${variant.toUpperCase()} navigation`} className={styles.sceneNav}><span>Send</span><span>For business</span><span>Track</span></nav>
      <span className={styles.sceneAction}>Get a quote</span>
    </header>
    <div className={styles.sceneCopy}>
      <FrameNumber id="h0" verb="WORLD" />
      <h3>Move what matters.</h3>
      <p>Before anything moves, it matters to someone.</p>
    </div>
  </div>;
}

function H2Card({ variant, width }: { variant: "a" | "b" | "c"; width: ReviewWidth }) {
  const source = variant === "a" ? media.h2a : variant === "b" ? media.h2b : media.h2c;
  return <div className={`${styles.actionCard} ${width === "mobile" ? styles.actionCardMobile : styles.actionCardDesktop} ${styles[`h2${variant}`]}`}>
    <ReviewImage src={source} alt={variant === "a" ? "A hand touching the plastic wrap around flowers" : variant === "b" ? "A gloved shopper choosing a bouquet at a flower stall" : "Two shoppers selecting flowers at an outdoor flower shop"} className={styles.actionImage} sizes={width === "mobile" ? "390px" : "(max-width: 767px) 100vw, 33vw"} />
    <div className={styles.actionMarker}><span>SELECT</span><i aria-hidden="true" /></div>
  </div>;
}

function H3Card({ variant, width }: { variant: "current" | "alternative"; width: ReviewWidth }) {
  const source = variant === "current" ? media.h3 : media.h3alt;
  return <div className={`${styles.actionCard} ${width === "mobile" ? styles.actionCardMobile : styles.actionCardDesktop} ${variant === "current" ? styles.h3Current : styles.h3Alternative}`}>
    <ReviewImage src={source} alt={variant === "current" ? "Florist preparing a bouquet at a work surface" : "Close-up of hands arranging stems into a bouquet"} className={styles.actionImage} sizes={width === "mobile" ? "390px" : "(max-width: 767px) 100vw, 50vw"} />
    <div className={styles.h3Overlay}><FrameNumber id="h3" verb="PREPARE" /><p>Someone gets it ready.</p></div>
  </div>;
}

function H4Card({ placement, width }: { placement: "a" | "b" | "c"; width: ReviewWidth }) {
  return <div className={`${styles.h4Card} ${width === "mobile" ? styles.h4CardMobile : styles.h4CardDesktop} ${styles[`h4Placement${placement.toUpperCase()}`]}`}>
    <ReviewImage src={media.h4} alt="Florist and customer exchanging a bag containing a bouquet" className={styles.h4Image} sizes={width === "mobile" ? "390px" : "(max-width: 767px) 100vw, 33vw"} />
    <div className={styles.h4Copy}><FrameNumber id="h4" verb="TRANSFER" /><h3>Responsibility changes hands.</h3></div>
  </div>;
}

function ContactFrame({ id, src, alt, className }: { id: FrameId; src?: string; alt: string; className?: string }) {
  return <div className={`${styles.contactFrame} ${className ?? ""}`}>
    {src ? <ReviewImage src={src} alt={alt} className={styles.contactImage} sizes="(max-width: 767px) 44vw, 16vw" /> : <div className={styles.contactCarbon}><span>REAL KT MEDIA</span></div>}
    <div className={styles.contactTag}><strong>{id.toUpperCase()}</strong><span>{frames.find((item) => item.id === id)?.label}</span></div>
  </div>;
}

function ContactSheet({ width }: { width: ReviewWidth }) {
  const isMobile = width === "mobile";
  return <div className={`${styles.contactSheet} ${isMobile ? styles.contactSheetMobile : styles.contactSheetDesktop}`}>
    <ContactFrame id="h0" src={media.h0b} alt="Provisional H0 market-aisle opening" className={styles.contactH0} />
    <ContactFrame id="h1" src={media.h1} alt="Approved H1 threshold frame" className={styles.contactH1} />
    <ContactFrame id="h2" src={media.h2c} alt="Provisional H2 shoppers selecting flowers" className={styles.contactH2} />
    <ContactFrame id="h3" src={media.h3} alt="Provisional H3 bouquet preparation frame" className={styles.contactH3} />
    <ContactFrame id="h4" src={media.h4} alt="Approved H4 handoff frame" className={styles.contactH4} />
    <ContactFrame id="h5" alt="H5 carbon placeholder retaining the H4 actor for later network media" className={styles.contactH5} />
    <div className={styles.contactSequence}>WORLD <span>→</span> ENTER <span>→</span> CHOICE <span>→</span> PREPARE <span>→</span> TRANSFER <span>→</span> RELEASE</div>
  </div>;
}

export function RelayFilmboard({ fontVariables, initialFrame }: { fontVariables: string; initialFrame: FrameId }) {
  const [selected, setSelected] = useState<FrameId>(initialFrame);
  const frame = frames.find((item) => item.id === selected)!;

  function jumpTo(id: FrameId) {
    setSelected(id);
    document.getElementById(`${id}-sheet`)?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  return <main className={`${styles.filmboard} ${fontVariables}`}>
    <a className={styles.skipLink} href="#h0-sheet">Skip to comparison sheets</a>
    <header className={styles.reviewHeader}>
      <div><p className={styles.reviewKicker}>KT COURIER / PHASE 2D-B2</p><h1>The Relay — static filmboard correction</h1><p className={styles.reviewStatus}>VISUAL OPTIONS READY <span>·</span> PRINCIPAL REVIEW PENDING</p></div>
      <div className={styles.reviewHeaderMeta}><span>WORLD → ENTER → SELECT → PREPARE → TRANSFER → RELEASE</span><span>THE RELAY / THERE → HERE</span><span>No motion · no production approval</span></div>
    </header>

    <section aria-labelledby="review-intent-heading" className={styles.reviewIntent}>
      <div><p className={styles.sectionEyebrow}>REVIEW INTENT</p><h2 id="review-intent-heading">Before anything moves, it matters to someone.</h2></div>
      <p>Focused comparisons are shown first. H0, H2, H3, and H4 remain open choices; the full contact sheets below are provisional implementer selections only.</p>
    </section>

    <section className={styles.reviewSection} id="h0-sheet" aria-labelledby="h0-sheet-heading">
      <SectionHeading eyebrow="A / H0 — WORLD" title="Opening composition A/B" detail="Judge living commerce before courier, parcel, or delivery. Each frame keeps the header inside the scene." />
      <div className={styles.sheetGridH0}><SheetCard label="H0-A / ROSEBANK" note="existing image · desktop"><H0Card variant="a" width="desktop" /></SheetCard><SheetCard label="H0-B / MARKET AISLE" note="local editorial image · desktop"><H0Card variant="b" width="desktop" /></SheetCard><SheetCard label="H0-A / ROSEBANK" note="390 crop"><H0Card variant="a" width="mobile" /></SheetCard><SheetCard label="H0-B / MARKET AISLE" note="390 crop"><H0Card variant="b" width="mobile" /></SheetCard></div>
      <p className={styles.constraintNote}>H0-B is intentionally not labeled Johannesburg or South Africa. Header contrast stays provisional until the principal chooses the opening.</p>
    </section>

    <section className={styles.reviewSection} id="h1-sheet" aria-labelledby="h1-sheet-heading">
      <SectionHeading eyebrow="PRESERVED / H1 — ENTER" title="Threshold stays; mobile crop changes" detail="The approved photograph remains unchanged. The mobile crop moves toward person + hand + door while retaining foreground foliage depth." />
      <div className={styles.preservedGrid}><SheetCard label="H1 / DESKTOP" note="preserved approved frame"><div className={styles.preservedFrame}><ReviewImage src={media.h1} alt="Approved threshold photograph" className={styles.preservedImage} sizes="(max-width: 767px) 100vw, 50vw" /></div></SheetCard><SheetCard label="H1 / 390" note="repositioned crop"><div className={`${styles.preservedFrame} ${styles.preservedFrameMobile}`}><ReviewImage src={media.h1} alt="Threshold crop showing the person, hand, door, and foliage" className={styles.preservedImage} sizes="390px" /></div></SheetCard></div>
    </section>

    <section className={styles.reviewSection} id="h2-sheet" aria-labelledby="h2-sheet-heading">
      <SectionHeading eyebrow="B / H2 — CHOICE" title="Visible-verb test: SELECT" detail="No supporting copy is used in the image area. Compare whether the hand is selecting an actual product rather than touching plastic." />
      <div className={styles.sheetGridH2}>{(["a", "b", "c"] as const).map((variant) => <SheetCard key={`h2-${variant}-desktop`} label={`H2-${variant.toUpperCase()} / DESKTOP`} note={variant === "a" ? "current" : "candidate"}><H2Card variant={variant} width="desktop" /></SheetCard>)}{(["a", "b", "c"] as const).map((variant) => <SheetCard key={`h2-${variant}-mobile`} label={`H2-${variant.toUpperCase()} / 390`} note={variant === "a" ? "current" : "candidate"}><H2Card variant={variant} width="mobile" /></SheetCard>)}</div>
      <p className={styles.constraintNote}>H2-C is the provisional contact-sheet choice because the selection gesture remains legible at narrow width; this is not principal approval.</p>
    </section>

    <section className={styles.reviewSection} id="h3-sheet" aria-labelledby="h3-sheet-heading">
      <SectionHeading eyebrow="C / H3 — PREPARE" title="Hands + bouquet + work" detail="The current source is recomposed first. The alternative is retained as a mobile fallback only if the current crop fails the tactile work test." />
      <div className={styles.sheetGridH3}><SheetCard label="H3 / CURRENT · DESKTOP" note="revised crop"><H3Card variant="current" width="desktop" /></SheetCard><SheetCard label="H3 / CURRENT · 390" note="revised crop"><H3Card variant="current" width="mobile" /></SheetCard><SheetCard label="H3 / ALTERNATIVE · 390" note="fallback comparison"><H3Card variant="alternative" width="mobile" /></SheetCard></div>
    </section>

    <section className={styles.reviewSection} id="h4-sheet" aria-labelledby="h4-sheet-heading">
      <SectionHeading eyebrow="PRESERVED / D — H4 — TRANSFER" title="Typography placement studies" detail="The handoff photograph is locked. The phrase stays exact; only placement and wrap change. Schibsted remains regular/medium." />
      <div className={styles.sheetGridH4}>{(["a", "b", "c"] as const).map((placement) => <SheetCard key={`h4-${placement}-desktop`} label={`H4 / DESKTOP OPTION ${placement.toUpperCase()}`} note="same photograph"><H4Card placement={placement} width="desktop" /></SheetCard>)}{(["b", "c"] as const).map((placement) => <SheetCard key={`h4-${placement}-mobile`} label={`H4 / 390 OPTION ${placement.toUpperCase()}`} note="different mobile placement"><H4Card placement={placement} width="mobile" /></SheetCard>)}</div>
      <p className={styles.constraintNote}>The transfer gesture remains the protagonist in every study. No box, gradient, darkening, or separate text column is used.</p>
    </section>

    <section className={styles.reviewSection} id="contact-sheets" aria-labelledby="contact-sheets-heading">
      <SectionHeading eyebrow="PROVISIONAL / FULL CONTACT SHEETS" title="Best provisional sequence" detail="These are implementer choices for review: H0-B, H1 preserved, H2-C, current H3 revised crop, H4 option C, and H5 preserved carbon environment." />
      <div className={styles.fullContactGrid}><SheetCard label="DESKTOP / 1440" note="provisional"><ContactSheet width="desktop" /></SheetCard><SheetCard label="MOBILE / 390" note="provisional"><ContactSheet width="mobile" /></SheetCard></div>
    </section>

    <section className={styles.reviewSection} id="asset-ledger" aria-labelledby="asset-ledger-heading">
      <SectionHeading eyebrow="MEDIA LEDGER" title="Added and reused media" detail="These paths are dev review assets only. Production authority, routes, API, marketplace media, and configuration safety are unchanged." />
      <div className={styles.assetLedger}><div><span>REUSED / LOCAL</span><a href={media.h0a}>relay-h0-rosebank-market.webp</a><a href={media.h1}>relay-h1-threshold.webp</a><a href={media.h2a}>relay-h2-choice.webp</a><a href={media.h3}>relay-h3-preparation.webp</a><a href={media.h4}>relay-h4-handoff.webp</a></div><div><span>REUSED / EARLIER LOCAL SOURCE</span><a href={media.h0b}>h0-b-market-aisle.jpg</a><small>Source: <a href={mediaSources.h0b}>Unsplash candidate</a></small></div><div><span>ADDED / EXACT REVIEW CANDIDATES</span><a href={media.h2b}>h2-b-woman-buying-flowers.jpg</a><a href={media.h2c}>h2-c-women-selecting-flowers.jpg</a><a href={media.h3alt}>h3-alt-arranging-bouquet.jpg</a><small><a href={mediaSources.h2b}>H2-B source</a> · <a href={mediaSources.h2c}>H2-C source</a> · <a href={mediaSources.h3alt}>H3 alternative source</a></small></div></div>
    </section>

    <nav aria-label="Filmboard frame selector" className={styles.selector}>{frames.map((item) => <button aria-current={selected === item.id ? "page" : undefined} className={selected === item.id ? styles.selectorCurrent : undefined} key={item.id} onClick={() => jumpTo(item.id)} type="button"><span>{item.verb}</span><small>{item.label}</small></button>)}</nav>
    <p className={styles.selectedStatus} aria-live="polite">Review focus: {frame.verb} / {frame.label} · design-lab notation only</p>
  </main>;
}
