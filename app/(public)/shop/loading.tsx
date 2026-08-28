import styles from "@/components/public-v2/commerce/commerce.module.css";

export default function StorefrontLoading() {
  return (
    <main aria-busy="true" className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner} style={{ padding: "4rem 0" }}>
        <div
          style={{
            height: "40px",
            width: "280px",
            backgroundColor: "var(--kt-cool-100, #eceeee)",
            marginBottom: "24px",
          }}
        />
        <div className={styles.productGrid}>
          {Array.from({ length: 8 }, (_, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1.15",
                  backgroundColor: "var(--kt-cool-100, #eceeee)",
                }}
              />
              <div
                style={{
                  height: "16px",
                  width: "70%",
                  backgroundColor: "var(--kt-cool-100, #eceeee)",
                }}
              />
              <div
                style={{
                  height: "16px",
                  width: "40%",
                  backgroundColor: "var(--kt-cool-100, #eceeee)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
