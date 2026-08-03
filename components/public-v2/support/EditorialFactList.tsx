import styles from "./support-pages.module.css";

export type EditorialFact = { label: string; value: string; detail?: string };

export function EditorialFactList({ facts }: { facts: readonly EditorialFact[] }) {
  return (
    <dl className={styles.factList}>
      {facts.map((fact, index) => (
        <div key={fact.label}>
          <dt><span>{String(index + 1).padStart(2, "0")}</span>{fact.label}</dt>
          <dd>{fact.value}</dd>
          {fact.detail ? <p>{fact.detail}</p> : null}
        </div>
      ))}
    </dl>
  );
}
