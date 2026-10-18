import Image from "next/image";
import { ktMedia } from "@/components/public-v2/media";
import styles from "./auth-pages.module.css";

interface AuthMediaCompositionProps {
  primaryImage?: string;
  primaryAlt?: string;
  secondaryImage?: string;
  secondaryAlt?: string;
}

export function AuthMediaComposition({
  primaryImage = ktMedia.auth.customer.src,
  primaryAlt = ktMedia.auth.customer.alt,
  secondaryImage = ktMedia.auth.product.src,
  secondaryAlt = ktMedia.auth.product.alt,
}: AuthMediaCompositionProps) {
  return (
    <aside aria-label="Local shopping and courier delivery" className={styles.mediaPlane}>
      <div className={styles.mediaMainTile}>
        <Image alt={primaryAlt} fill sizes="(max-width: 1023px) 100vw, 55vw" src={primaryImage} style={{ objectFit:"cover" }} priority />
      </div>
      <div className={styles.authEditorialCopy}>
        <span>SHOP LOCAL. SEND WITH KT.</span>
        <p>From first order to final handoff.</p>
      </div>
      {secondaryImage ? <div className={styles.mediaSecondaryTile}>
        <Image alt={secondaryAlt} fill sizes="(max-width: 1023px) 42vw, 230px" src={secondaryImage} style={{ objectFit:"cover" }}/>
      </div>:null}
    </aside>
  );
}
