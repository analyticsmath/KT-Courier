import Link from "next/link";
import { RouteLine } from "@/components/public-v2/graphics";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { PublicBreadcrumbScript } from "@/components/public-v2/support";
import { DEVELOPER_API_VERSION, DEVELOPER_SCOPE_DESCRIPTIONS, DEVELOPER_SCOPES } from "@/lib/developer-api/contracts";
import { PUBLIC_API_ROUTE_MANIFEST } from "@/lib/developer-api/openapi";
import styles from "./developers.module.css";

const useCases = [
  ["Quote requests", "Create delivery price quotes for an approved owner."],
  ["Courier orders", "Create, read, cancel eligible orders, and read safe tracking for approved ownership."],
  ["Store orders", "Read and manage approved store-order actions for an approved store."],
  ["Signed events", "Create and manage verified webhook subscriptions and read safe delivery history."],
] as const;

const visibleScopes = [
  DEVELOPER_SCOPES.QUOTES_WRITE,
  DEVELOPER_SCOPES.ORDERS_READ,
  DEVELOPER_SCOPES.ORDERS_WRITE,
  DEVELOPER_SCOPES.TRACKING_READ,
  DEVELOPER_SCOPES.STORE_ORDERS_MANAGE,
  DEVELOPER_SCOPES.WEBHOOKS_WRITE,
] as const;

const apiRouteGroups = [
  { label: "Quotes", route: "/quotes" },
  { label: "Orders", route: "/orders" },
  { label: "Catalog", route: "/catalog/products" },
  { label: "Store orders", route: "/store-orders" },
  { label: "Webhooks", route: "/webhooks" },
] as const;

const webhookExample = `POST /your-webhook-endpoint
Content-Digest: <digest of raw body>
Signature: <HTTP message signature>
Webhook-Id: <event identifier>
Webhook-Timestamp: <timestamp>

{
  "type": "za.co.ktcouriers.order.updated.v1",
  "data": { "reference": "<owned order reference>" }
}`;

export function DeveloperOverviewPage({ signedIn = false }: { signedIn?: boolean }) {
  const entryHref = signedIn ? "/developers/applications" : "/login";
  const entryLabel = signedIn ? "Open developer applications" : "Sign in for developer access";

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Developers", href: "/developers" }]} />
      <div className={styles.inner}>
        <PublicBreadcrumbs className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Developers" }]} />
        <section className={styles.hero} aria-labelledby="developers-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Developer API · {DEVELOPER_API_VERSION}</p>
            <h1 id="developers-title">Connect delivery workflows to your software.</h1>
            <p className={styles.lead}>Apply for scoped API access, create approved credentials, and receive signed delivery events through governed server-to-server integrations.</p>
            <div className={styles.actionGroup}>
              <Link className={styles.primaryAction} href={entryHref}>{entryLabel}</Link>
              <a className={styles.secondaryAction} href="/api/openapi/v1.json">Read the OpenAPI contract</a>
            </div>
          </div>
          <aside className={styles.technicalPlane} aria-label="Developer API contract summary">
            <p>OpenAPI 3.1.2</p>
            <div className={styles.scopeFragments}>{visibleScopes.slice(0, 3).map((scope) => <code key={scope}>{scope}</code>)}</div>
            <RouteLine className={styles.routeLine} segment="documentary" variant="documentary" />
            <p className={styles.technicalNote}>Credentials and signing secrets belong in a protected backend environment, never browser code, storage, cookies, URLs, or logs.</p>
          </aside>
        </section>
      </div>

      <section className={styles.section} aria-labelledby="developer-use-cases-title">
        <div className={styles.inner}>
          <p className={styles.eyebrow}>Supported use cases</p>
          <h2 id="developer-use-cases-title">A bounded delivery API.</h2>
          <div className={styles.useCases}>{useCases.map(([title, description], index) => <article key={title}><span aria-hidden="true">0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionMuted}`} aria-labelledby="developer-access-title">
        <div className={styles.inner}>
          <div className={styles.splitHeading}><div><p className={styles.eyebrow}>Access and application lifecycle</p><h2 id="developer-access-title">Access is specific, reviewed, and owner-bound.</h2></div><p>Start in the existing developer account route. Applications move through the canonical lifecycle: draft, submitted, under review, approved, then active where appropriate. Terms are accepted through the existing application flow.</p></div>
          <ol className={styles.lifecycle}><li><span>01</span><strong>Create a draft</strong><p>Record the integration purpose and intended environment through the authenticated route.</p></li><li><span>02</span><strong>Submit for review</strong><p>The canonical application workflow records terms acceptance before submission.</p></li><li><span>03</span><strong>Receive approved scopes</strong><p>Credentials require an active, approved scope grant and are bound to the application owner.</p></li><li><span>04</span><strong>Keep credentials protected</strong><p>An opaque credential or signing secret is shown once only; rotate or revoke it through the protected route if necessary.</p></li></ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="developer-reference-title">
        <div className={styles.inner}>
          <p className={styles.eyebrow}>Reference summary</p>
          <h2 id="developer-reference-title">Work from the contract, not assumptions.</h2>
          <div className={styles.referenceGrid}>
            <article><h3>Authentication and environments</h3><p>Use an opaque bearer credential from a protected server environment. The contract includes a test environment; live API access remains unavailable until it is activated.</p></article>
            <article><h3>Scopes</h3><p>Scopes constrain what an approved application may do. They are not account permissions and are granted through the canonical review process.</p><ul>{visibleScopes.map((scope) => <li key={scope}><code>{scope}</code><span>{DEVELOPER_SCOPE_DESCRIPTIONS[scope]}</span></li>)}</ul></article>
            <article><h3>Rate limits and quotas</h3><p>Every operation names a rate-limit class and quota categories in the OpenAPI contract. The contract does not publish a universal numeric allocation, so this page does not invent one.</p></article>
            <article><h3>Idempotency</h3><p>Send the documented <code>Idempotency-Key</code> for operations that declare it. Reuse a key only for the same intended request.</p></article>
            <article><h3>Errors</h3><p>Rejected requests use RFC 9457-style Problem Details: <code>type</code>, <code>title</code>, <code>status</code>, <code>detail</code>, <code>instance</code>, <code>code</code>, and <code>requestId</code>; retry information appears when applicable.</p></article>
            <article><h3>Versioning</h3><p>The public contract is versioned as {DEVELOPER_API_VERSION}. Use the served OpenAPI document as the authoritative route and schema reference.</p></article>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.webhookSection}`} aria-labelledby="developer-webhooks-title">
        <div className={styles.inner}>
          <div className={styles.webhookLayout}>
            <div>
              <p className={styles.eyebrow}>Webhooks</p>
              <h2 id="developer-webhooks-title">Verify, then process events safely.</h2>
              <p className={styles.lead}>Create a webhook subscription through the protected owner route, complete its verification, and verify the raw request body before processing an event.</p>
              <ul className={styles.webhookList}><li>Verify the raw bytes, <code>Content-Digest</code>, HTTP message signature, timestamp tolerance, and replay protection.</li><li>Process events asynchronously after verification; do not use a secret in browser code or logs.</li><li>Delivery retries are governed by the canonical webhook lifecycle. Authorized owners may request an eligible retry through the protected route.</li></ul>
            </div>
            <pre aria-label="Webhook verification envelope example" className={styles.codeBlock}><code>{webhookExample}</code></pre>
          </div>
        </div>
      </section>

      <section className={styles.contractSection} aria-labelledby="developer-contract-title">
        <div className={styles.inner}>
          <div><p className={styles.eyebrow}>OpenAPI access</p><h2 id="developer-contract-title">See the exact route and method contract.</h2><p className={styles.bodyCopy}>The OpenAPI resource is served from the canonical checked-in contract. It is documentation, not a browser API console.</p></div>
          <div className={styles.contractPanel}><div className={styles.routeList}>{apiRouteGroups.filter((entry) => entry.route in PUBLIC_API_ROUTE_MANIFEST).map((entry) => <p key={entry.route}><span>{entry.label}</span><code>{entry.route}</code></p>)}</div><div className={styles.actionGroup}><a className={styles.primaryAction} href="/api/openapi/v1.json">Download OpenAPI {DEVELOPER_API_VERSION}</a><Link className={styles.secondaryAction} href={entryHref}>{entryLabel}</Link></div></div>
        </div>
      </section>
    </article>
  );
}
