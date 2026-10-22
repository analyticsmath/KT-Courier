import { cache } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadPublishedPolicy, publicPolicyDefinitions, type PublicPolicyId } from "@/lib/public-legal/published-policy";
import { parsePublishedPolicy, type PolicyBlock } from "@/lib/public-legal/policy-formatting";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import styles from "./legal-pages.module.css";

const currentPolicy = cache(async (id: PublicPolicyId) => {
  await connection();
  return loadPublishedPolicy(id);
});

const editorial: Record<PublicPolicyId, { introduction: string; quickTitle: string; details: readonly { title: string; description: string }[] }> = {
  "privacy-notice": {
    introduction: "How KT Couriers handles personal information when you browse, create an account, place an order or take part in our delivery network.",
    quickTitle: "Your information, explained",
    details: [
      { title: "Information we use", description: "The information required to manage accounts, orders, deliveries, business relationships and support." },
      { title: "How it is handled", description: "Our published notice explains processing purposes, sharing, security, retention and applicable rights." },
      { title: "A privacy question?", description: "Contact our support team with “Privacy Request” in your email subject line." },
    ],
  },
  "website-terms": {
    introduction: "The conditions that govern access to KT Couriers, from customer accounts and marketplace services to delivery arrangements.",
    quickTitle: "Before you use the platform",
    details: [
      { title: "Your account", description: "Read the responsibilities associated with registration, accurate information and account security." },
      { title: "Services and payments", description: "Understand how marketplace activity, deliveries, service charges and third parties are addressed." },
      { title: "Your legal rights", description: "The full terms must be read alongside applicable consumer-protection law and service-specific conditions." },
    ],
  },
  "refund-policy": {
    introduction: "A clear explanation of cancellations, refund requests and the process for investigating an order or delivery problem.",
    quickTitle: "When something goes wrong",
    details: [
      { title: "Tell us what happened", description: "Include your order reference, the issue and any supporting information that may help us investigate." },
      { title: "Different orders, different remedies", description: "Available remedies depend on the circumstances, the vendor or delivery service involved, and applicable law." },
      { title: "Refund processing", description: "Approved refunds are generally submitted within seven business days; bank and provider timelines may differ." },
    ],
  },
  "shipping-policy": {
    introduction: "What to expect when arranging a collection or delivery, including service coverage, handovers, timing and delivery exceptions.",
    quickTitle: "Planning a delivery",
    details: [
      { title: "Check availability", description: "Available services depend on the collection point, destination and the operational region enabled for your request." },
      { title: "Prepare the details", description: "Provide complete addresses, contact information, parcel details and any relevant handling instructions." },
      { title: "Understand the estimate", description: "Delivery times and fees are subject to the selected service, confirmed quote and operational conditions." },
    ],
  },
};

function PolicyBlocks({ blocks }: { blocks: readonly PolicyBlock[] }) {
  return <>
    {blocks.map((block, i) => {
      if (block.kind === "subheading") return <h3 key={i} className={styles.subheading}>{block.text}</h3>;
      if (block.kind === "list") return <ul className={styles.documentList} key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</ul>;
      return <p key={i} className={styles.documentParagraph}>{block.text}</p>;
    })}
  </>;
}

export async function publishedPolicyMetadata(id: PublicPolicyId) {
  const definition = publicPolicyDefinitions[id];
  const policy = await currentPolicy(id);
  return publicPageMetadata({
    title: definition.title,
    description: editorial[id].introduction,
    route: definition.route,
    noindex: !policy,
  });
}

export async function PublishedPolicyPage({ documentId }: { documentId: PublicPolicyId }) {
  const definition = publicPolicyDefinitions[documentId];
  const policy = await currentPolicy(documentId);
  const copy = editorial[documentId];
  const sections = policy ? parsePublishedPolicy(policy.content) : [];
  const effectiveDate = policy ? new Date(policy.effectiveAt).toLocaleDateString("en-ZA", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg",
  }) : null;

  return <article className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.backLink}>← Back to KT Couriers</Link>
        <h1 className={styles.title}>{definition.title}</h1>
        <p className={styles.summary}>{copy.introduction}</p>
        {effectiveDate && <p className={styles.effectiveDate}>Effective from {effectiveDate}</p>}
      </div>
    </header>

    <div className={styles.body}>
      <div className={styles.bodyInner}>
        {policy ? <>
          <section aria-labelledby="policy-at-glance" className={styles.quickRead}>
            <div className={styles.quickHeader}>
              <h2 id="policy-at-glance">{copy.quickTitle}</h2>
              <p>A short guide to help you navigate the complete policy below.</p>
            </div>
            <div className={styles.quickGrid}>
              {copy.details.map((item) => <div className={styles.quickItem} key={item.title}>
                <h3>{item.title}</h3><p>{item.description}</p>
              </div>)}
            </div>
          </section>

          <div className={styles.readingLayout}>
            <nav className={styles.readingNav} aria-label="Policy sections">
              <p className={styles.navHeading}>Contents</p>
              <ol>{sections.map((section) =>
                <li key={section.id}><a href={"#" + section.id}>{section.title}</a></li>)}</ol>
            </nav>
            <div className={styles.documentColumn}>
              <div className={styles.documentIntro}>
                <h2>Full policy</h2>
                <p>The sections below reproduce the current published policy. The overview above is a reading guide and does not replace the full terms.</p>
              </div>
              <div className={styles.policySections}>
                {sections.map((section) => <section className={styles.policySection} id={section.id} key={section.id}>
                  <h2>{section.title}</h2>
                  <PolicyBlocks blocks={section.blocks} />
                </section>)}
              </div>
            </div>
          </div>
        </> : <section className={styles.unavailable}>
          <h2>This policy is not currently available online.</h2>
          <p>For a copy of the applicable policy before placing an order or accepting any terms, contact KT Couriers at <a href="mailto:support@ktcouriers.com">support@ktcouriers.com</a>.</p>
        </section>}

        <section className={styles.contactStrip} aria-label="Policy assistance">
          <div><h2>Need help understanding this policy?</h2><p>For questions about a specific order or your rights, contact KT Couriers and include your reference where available.</p></div>
          <Link href="/contact">Contact support <span aria-hidden="true">↗</span></Link>
        </section>
        <nav className={styles.relatedLinks} aria-label="Related information">
          <Link href="/terms">Terms</Link><Link href="/privacy-policy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link><Link href="/shipping-policy">Shipping</Link>
          <Link href="/accessibility">Accessibility</Link><Link href="/safety">Safety</Link>
        </nav>
      </div>
    </div>
  </article>;
}
