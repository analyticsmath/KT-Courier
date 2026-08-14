import Image from "next/image";
import { signatureMedia } from "@/components/public-v2/home/signature-media";
import styles from "./visual-lab.module.css";

const states = ["Request received", "Pickup scheduled", "Picked up", "In transit", "Delivered"] as const;

export function VisualLab() {
  return (
    <div className={styles.lab}>
      <header className={styles.header}>
        <Image alt="KT Couriers logo" height={1024} preload sizes="184px" src="/images/kt-couriers/brand/logo.svg" width={1024} />
        <p>Internal visual laboratory · never shipped to production</p>
      </header>
      <section aria-labelledby="lab-type">
        <p className={styles.label}>Typography / Mona Sans variable</p>
        <h1 id="lab-type">Move what matters.</h1>
        <p className={styles.widthSample}>A wider display setting holds the opening with a compact, architectural rhythm.</p>
        <p className={styles.mono}>KT / 01 — R 49.00 — Johannesburg — state reference</p>
      </section>
      <section aria-labelledby="lab-colour">
        <p className={styles.label}>Color authority</p>
        <h2 id="lab-colour">Neutral structure. Precise signals.</h2>
        <div className={styles.swatches}>
          <span>Canvas</span><span>Raised</span><span>Ink</span><span>Blue</span><span>Red</span>
        </div>
      </section>
      <section aria-labelledby="lab-controls" className={styles.controlSection}>
        <p className={styles.label}>Action and status</p>
        <h2 id="lab-controls">A clear next state.</h2>
        <div className={styles.controls}><button type="button">Get a quote ↗</button><button type="button">Explore marketplace →</button><label>Pickup location<input defaultValue="Johannesburg" /></label></div>
        <ol>{states.map((state, index) => <li key={state}><span>{String(index + 1).padStart(2, "0")}</span>{state}</li>)}</ol>
      </section>
      <section aria-labelledby="lab-crops">
        <p className={styles.label}>Media crop checks</p>
        <h2 id="lab-crops">Preparation, route, handoff.</h2>
        <div className={styles.mediaGrid}>
          {[signatureMedia.merchant, signatureMedia.abundance, signatureMedia.handoff].map((media) => <figure aria-label={media.image ? media.alt : `Media pending: ${media.alt}`} data-media-slot={media.slot} data-media-status={media.status} key={media.slot}>
            {media.image ? <Image alt={media.alt} fill placeholder="blur" sizes="(max-width: 699px) 82vw, 28vw" src={media.image} style={{ objectPosition: media.objectPosition }} /> : <span className={styles.mediaPending}>Media pending</span>}
          </figure>)}
        </div>
      </section>
    </div>
  );
}
