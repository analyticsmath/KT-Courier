import Image from "next/image";
import type { AuthMediaAsset } from "@/lib/public-assets/auth-media";
import styles from "./auth-pages.module.css";

export function AuthMediaFrame({ asset }: { asset: AuthMediaAsset }) {
  return (
    <aside className={styles.mediaPlane} aria-label="KT Couriers operations">
      <figure className={styles.mediaFrame}>
        <Image
          className={styles.mediaImage}
          src={asset.src}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          sizes="(min-width: 1440px) 510px, 36vw"
          style={{ objectPosition: asset.focalPoint }}
        />
        <figcaption className={styles.mediaCaption}>
          Every account step supports a clear delivery handoff.
        </figcaption>
      </figure>
    </aside>
  );
}
