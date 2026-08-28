import Image from "next/image";
import styles from "./auth-pages.module.css";

interface AuthMediaCompositionProps {
  primaryImage?: string;
  primaryAlt?: string;
  secondaryImage?: string;
  secondaryAlt?: string;
}

export function AuthMediaComposition({
  primaryImage = "/media/public/auth/kt-auth-01-customer.webp",
  primaryAlt = "KT Couriers account access",
  secondaryImage = "/media/public/auth/kt-auth-03-product.webp",
  secondaryAlt = "Product detail",
}: AuthMediaCompositionProps) {
  return (
    <div aria-hidden="true" className={styles.mediaPlane}>
      <div className={styles.mediaMainTile}>
        <Image
          alt={primaryAlt}
          fill
          sizes="(max-width: 1023px) 0px, 600px"
          src={primaryImage}
          style={{ objectFit: "cover" }}
        />
      </div>
      {secondaryImage ? (
        <div className={styles.mediaSecondaryGrid}>
          <div className={styles.mediaSecondaryTile}>
            <Image
              alt={secondaryAlt}
              fill
              sizes="(max-width: 1023px) 0px, 300px"
              src={secondaryImage}
              style={{ objectFit: "cover" }}
            />
          </div>
          <div
            style={{
              borderRadius: "var(--kt-radius-media)",
              backgroundColor: "var(--kt-white)",
              border: "1px solid var(--kt-cool-200)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--kt-red)", textTransform: "uppercase" }}>
              Encrypted Session
            </span>
            <p style={{ fontSize: "0.85rem", color: "var(--kt-graphite)", lineHeight: 1.4 }}>
              Direct access to parcel deliveries, scheduled requests and order histories.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
