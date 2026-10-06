import { cache } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadPublishedPolicy, publicPolicyDefinitions, type PublicPolicyId } from "@/lib/public-legal/published-policy";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import styles from "./legal-pages.module.css";

const currentPolicy = cache(async (id: PublicPolicyId) => {
  await connection();
  return loadPublishedPolicy(id);
});

export async function publishedPolicyMetadata(id: PublicPolicyId) {
  const definition = publicPolicyDefinitions[id];
  const policy = await currentPolicy(id);
  return publicPageMetadata({
    title: definition.title, description: `${definition.title} for KT Couriers.`,
    route: definition.route, noindex: !policy,
  });
}

export async function PublishedPolicyPage({ documentId }: { documentId: PublicPolicyId }) {
  const definition = publicPolicyDefinitions[documentId];
  const policy = await currentPolicy(documentId);
  const paragraphs = policy?.content.split(/\r?\n/).map((line: string) => line.trim()).filter(Boolean) ?? [];
  return <article className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <h1 className={styles.title}>{definition.title}</h1>
        {policy && <p className={styles.summary}>Version {policy.version} · Effective {new Date(policy.effectiveAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg" })}</p>}
      </div>
    </header>
    <div className={styles.body}><div className={styles.bodyInner}>
      {policy ? <div className={styles.sections}>
        {paragraphs.map((text: string, index: number) => /^\d+\.\s/.test(text)
          ? <h2 key={index}>{text}</h2>
          : /^\d+\.\d+\s/.test(text)
            ? <h3 key={index}>{text}</h3>
            : <p key={index} style={{ whiteSpace: "pre-line" }}>{text}</p>)}
      </div> : <p>This policy is currently unavailable. Contact <a href="mailto:info@ktcouriers.com">info@ktcouriers.com</a> before placing an order.</p>}
      <p className={styles.footerNote}>
        <Link href="/terms">Terms</Link>{" · "}<Link href="/privacy-policy">Privacy</Link>{" · "}
        <Link href="/refund-policy">Refunds and cancellations</Link>{" · "}<Link href="/shipping-policy">Shipping and delivery</Link>
      </p>
    </div></div>
  </article>;
}
