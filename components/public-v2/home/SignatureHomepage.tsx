import Image from "next/image";
import Link from "next/link";
import { MarketplaceCategoryRail } from "@/components/public-v2/marketplace/MarketplaceCards";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import type { HomepageFaqItem } from "./HomepageFaq";
import { SignatureHomepageMotion } from "./SignatureHomepageMotion";
import { signatureMedia, type StoryMedia } from "./signature-media";
import styles from "./signature-home.module.css";

const participation = [
  { href: "/signup?role=store", label: "Store", copy: "Bring your local commerce into the network." },
  { href: "/services/driver-network", label: "Driver", copy: "Carry the movement between people and places." },
  { href: "/contact", label: "Promoter", copy: "Help a neighbourhood discover what is nearby." },
] as const;

async function readHomepageData() {
  if (process.env.NODE_ENV !== "production") return { regions: [], storefront: null };
  const withinHomepageBudget = <T,>(promise: Promise<T>, fallback: T) => Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 900))]);
  const [regions, storefront] = await Promise.all([
    withinHomepageBudget(listDeliveryRegions(true).catch(() => []), []),
    withinHomepageBudget(getStorefrontHome().catch(() => null), null),
  ]);
  return { regions: regions.slice(0, 6), storefront };
}

function StoryImage({ media, className, priority = false, sizes, decorative = false }: { media: StoryMedia; className: string; priority?: boolean; sizes: string; decorative?: boolean }) {
  return <figure aria-hidden={decorative ? true : undefined} aria-label={decorative || media.image ? undefined : `Media pending: ${media.alt}`} className={className} data-media-slot={media.slot} data-media-status={media.status}>
    {media.image ? <Image alt={decorative ? "" : media.alt} fill placeholder="blur" priority={priority} sizes={sizes} src={media.image} style={{ objectPosition: media.objectPosition }} /> : null}
  </figure>;
}

function SouthAfricaOutline({ regions }: { regions: Array<{ name: string }> }) {
  return <div className={styles.geography}>
    <svg aria-label="South Africa" role="img" viewBox="0 0 420 310"><path d="M80 33 155 17l63 30 23 42 72 31-7 55 49 37-35 44-18 39-85-2-52-29-43 18-54-39 11-73-28-50 39-41z" /></svg>
    <div><p>South Africa</p><span>{regions.length ? regions.map((region) => region.name).join(" · ") : "Availability is confirmed through pickup and drop-off context."}</span></div>
  </div>;
}

export async function SignatureHomepage({ faqItems }: { faqItems: readonly HomepageFaqItem[] }) {
  const { regions, storefront } = await readHomepageData();
  const categories = storefront?.categories.slice(0, 4) ?? [];

  return <main className={styles.home} data-kt-signature-home="phase2c">
    <SignatureHomepageMotion />
    <section aria-labelledby="home-title" className={styles.stageA} data-stage="a">
      <div className={styles.stageSticky}>
        <StoryImage className={styles.aWorld} media={signatureMedia.world} priority sizes="(max-width: 767px) 100vw, 92vw" />
        <StoryImage className={styles.aThreshold} decorative media={signatureMedia.threshold} sizes="(max-width: 767px) 100vw, 29vw" />
        <StoryImage className={styles.aMerchant} media={signatureMedia.merchant} sizes="(max-width: 767px) 100vw, 58vw" />
        <div className={styles.editorialBand} data-a-band>
          <h1 id="home-title">Move what matters.</h1>
          <div><p>Local commerce, fulfilment and delivery connected through one network.</p><nav aria-label="Homepage actions" className={styles.actions}><Link className={styles.primaryAction} href={marketplaceHref()}>Explore marketplace <span aria-hidden="true">→</span></Link><Link className={styles.secondaryAction} href="/account/request-delivery">Move something <span aria-hidden="true">↗</span></Link></nav></div>
        </div>
        <p className={styles.aChoice} data-actor="a-choice">It starts with a choice.</p>
        <p className={styles.aMerchantCopy} data-actor="a-merchant-copy">Someone gets it ready.</p>
      </div>
    </section>

    <section aria-labelledby="handoff-title" className={styles.stageB} data-stage="b">
      <div className={styles.stageSticky}>
        <StoryImage className={styles.bMerchant} decorative media={signatureMedia.merchant} sizes="(max-width: 767px) 100vw, 48vw" />
        <StoryImage className={styles.bObject} media={signatureMedia.tactile} sizes="(max-width: 767px) 100vw, 30vw" />
        <StoryImage className={styles.bHandoff} media={signatureMedia.handoff} sizes="(max-width: 767px) 100vw, 76vw" />
        <StoryImage className={styles.bMovement} media={signatureMedia.movement} sizes="(max-width: 767px) 100vw, 100vw" />
        <p className={styles.objectContext}>Chosen close to home.</p>
        <div className={styles.handoffCopy} data-actor="handoff-copy"><h2 id="handoff-title">Responsibility changes hands.</h2><span className={styles.progress}><i>prepare</i><i>transfer</i><i>move</i></span><span className={styles.statusEvidence}>READY</span></div>
        <p className={styles.movementCopy} data-actor="movement-copy">Now it moves.</p>
      </div>
    </section>

    <section aria-labelledby="network-title" className={styles.stageC} data-stage="c">
      <div className={styles.stageSticky}>
        <StoryImage className={styles.cMovement} decorative media={signatureMedia.movement} sizes="(max-width: 767px) 100vw, 23vw" />
        <StoryImage className={styles.cAbundance} decorative media={signatureMedia.abundance} sizes="(max-width: 767px) 78vw, 18vw" />
        <StoryImage className={styles.cDiscovery} decorative media={signatureMedia.discovery} sizes="(max-width: 767px) 78vw, 24vw" />
        <StoryImage className={styles.cThreshold} decorative media={signatureMedia.threshold} sizes="(max-width: 767px) 78vw, 13vw" />
        <div className={styles.networkCopy} data-actor="network-copy"><h2 id="network-title">One network. Many ways to move.</h2><SouthAfricaOutline regions={regions} /></div>
        <div className={styles.marketplaceState} data-actor="marketplace-state">
          <div className={styles.marketplaceTop}><span>Marketplace</span><form action={marketplaceHref()} role="search"><label className="sr-only" htmlFor="phase2c-search">Search the marketplace</label><input id="phase2c-search" name="q" placeholder="Search products" type="search" /><button type="submit">Search</button></form><Link href={marketplaceHref()}>Browse all <span aria-hidden="true">→</span></Link></div>
          {categories.length ? <MarketplaceCategoryRail categories={categories} label="Published marketplace categories" /> : <div className={styles.marketplaceEmpty}><p>Marketplace categories will appear here when they are published.</p><Link href={marketplaceHref()}>Open marketplace <span aria-hidden="true">→</span></Link></div>}
        </div>
      </div>
    </section>

    <section aria-labelledby="participation-title" className={styles.participation}><div><p className={styles.contextLabel}>Participation</p><h2 id="participation-title">A network is made by people.</h2></div><div className={styles.participationPaths}>{participation.map((item) => <Link href={item.href} key={item.label}><strong>{item.label}</strong><p>{item.copy}</p><span aria-hidden="true">↗</span></Link>)}</div></section>
    <section aria-labelledby="questions-title" className={styles.questions}><div><p className={styles.contextLabel}>Useful answers</p><h2 id="questions-title">A clear next step.</h2></div><div>{faqItems.slice(0, 4).map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section aria-labelledby="resolve-title" className={styles.resolve}><StoryImage className={styles.resolveImage} media={signatureMedia.handoff} sizes="100vw" /><div className={styles.resolveScrim} /><div className={styles.resolveAction}><p className={styles.contextLabel}>Start here</p><h2 id="resolve-title">Make the next handoff clear.</h2><Link className={styles.primaryAction} href="/account/request-delivery">Get a quote <span aria-hidden="true">↗</span></Link></div></section>
  </main>;
}
