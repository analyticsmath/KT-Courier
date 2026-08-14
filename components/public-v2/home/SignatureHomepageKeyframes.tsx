import Image from "next/image";
import Link from "next/link";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getStorefrontHome } from "@/lib/services/storefront-catalog.service";
import { signatureMedia } from "./signature-media";
import styles from "./signature-keyframes.module.css";

const frames = [
  ["K0", "WORLD", "Move what matters.", "world"], ["K1", "THRESHOLD", "It starts with a choice.", "threshold"], ["K2", "MERCHANT", "Someone gets it ready.", "merchant"], ["K3", "OBJECT", "Chosen close to home.", "tactile"], ["K4", "HANDOFF", "Responsibility changes hands.", "handoff"], ["K5", "MOVEMENT", "Now it moves.", "movement"], ["K6", "NETWORK", "One network. Many ways to move.", "movement"], ["K7", "MARKETPLACE FORMATION", "The local field becomes useful.", "discovery"], ["K8", "PRODUCT", "Find what is ready to move.", "abundance"], ["K9", "RESOLVE", "Make the next handoff clear.", "handoff"],
] as const;

export async function SignatureHomepageKeyframes() {
  if (process.env.NODE_ENV !== "production") return <KeyframeCanvas categoryLabel="Published categories appear here when available." regionLabel="Availability is confirmed through pickup and drop-off context." />;
  const withinLabBudget = <T,>(promise: Promise<T>, fallback: T) => Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 900))]);
  const [regions, storefront] = await Promise.all([withinLabBudget(listDeliveryRegions(true).catch(() => []), []), withinLabBudget(getStorefrontHome().catch(() => null), null)]);
  const regionLabel = regions.slice(0, 6).map((region) => region.name).join(" · ");
  const categoryLabel = storefront?.categories.slice(0, 4).map((category) => category.name).join(" · ") || "Published categories appear here when available.";
  return <KeyframeCanvas categoryLabel={categoryLabel} regionLabel={regionLabel || "Availability is confirmed through pickup and drop-off context."} />;
}

function KeyframeCanvas({ categoryLabel, regionLabel }: { categoryLabel: string; regionLabel: string }) {
  return <main className={styles.lab}><header><Link href="/">KT Couriers</Link><p>Phase 2C static keyframe authority · visual review only</p></header><div className={styles.frames}>{frames.map(([key, label, title, mediaKey]) => { const media = signatureMedia[mediaKey]; return <section className={`${styles.frame} ${styles[key.toLowerCase()]}`} key={key}><figure aria-label={media.image ? media.alt : `Media pending: ${media.alt}`} data-media-slot={media.slot} data-media-status={media.status}>{media.image ? <Image alt={media.alt} fill placeholder="blur" priority={key === "K0"} sizes="(max-width: 767px) 100vw, 86vw" src={media.image} style={{ objectPosition: media.objectPosition }} /> : <span className={styles.mediaPending}>Media pending</span>}</figure><div className={styles.caption}><span>{key} · {label}</span><h1>{title}</h1>{key === "K0" ? <p>Local commerce, fulfilment and delivery connected through one network.</p> : null}{key === "K4" ? <small>prepare — transfer — move</small> : null}{key === "K6" ? <p>South Africa · {regionLabel}</p> : null}{key === "K7" || key === "K8" ? <p>{categoryLabel}</p> : null}</div></section>; })}</div></main>;
}
