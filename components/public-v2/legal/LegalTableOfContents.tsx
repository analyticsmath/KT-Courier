import styles from "./legal-pages.module.css";

export type LegalTableOfContentsItem = { id: string; heading: string };

export function LegalTableOfContents({ items }: { items: readonly LegalTableOfContentsItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="On this page" className={styles.toc}>
      <p className={styles.tocTitle}>On this page</p>
      <ol className={styles.tocList}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.heading}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
