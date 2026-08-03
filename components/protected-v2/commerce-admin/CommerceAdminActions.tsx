"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./commerce-admin.module.css";

type RequestAction = "approve" | "request-changes" | "reject" | "suspend" | "quarantine";
type StorefrontLifecycleStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED" | "REJECTED";

function operationId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function submit(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) throw new Error("This record changed before the request completed. Refresh and review the canonical record before trying again.");
    if (response.status === 429) throw new Error("The administration service is temporarily rate limited. Wait before trying again.");
    if (response.status >= 500) throw new Error("The administration service is temporarily unavailable. Try again later.");
    throw new Error("The administration service could not apply this request. Review the form and try again.");
  }
}

function ActionMessage({ message, error }: { message: string; error: boolean }) {
  return <p aria-live="polite" className={`${styles.formMessage} ${error ? styles.formError : ""}`} role={error ? "alert" : "status"}>{message}</p>;
}

export function CatalogModerationActions({
  productId,
  version,
  actions,
}: {
  productId: string;
  version: number;
  actions: readonly Extract<RequestAction, "approve" | "request-changes" | "reject" | "suspend">[];
}) {
  const router = useRouter();
  const [reasonCode, setReasonCode] = useState("CATALOG_REVIEWED");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: typeof actions[number]) {
    setBusy(true); setFailed(false); setMessage("Recording canonical moderation evidence…");
    try {
      await submit(`/api/admin/catalog/products/${encodeURIComponent(productId)}/${action}`, { version, operationId: operationId("catalog-moderation"), reasonCode });
      setMessage("Moderation evidence was recorded. Refreshing the source-backed record…");
      router.refresh();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "The moderation request failed.");
    } finally { setBusy(false); }
  }

  if (!actions.length) return <p className={styles.note}>This record is read-only for the current administrator or has no eligible moderation transition.</p>;
  return <div className={styles.actionForm}>
    <label htmlFor="commerce-moderation-reason">Reason code
      <input id="commerce-moderation-reason" maxLength={80} onChange={(event) => setReasonCode(event.target.value.toLocaleUpperCase("en-ZA").replace(/[^A-Z0-9_]/g, ""))} value={reasonCode} />
    </label>
    <div className={styles.actionRow}>
      {actions.map((action) => <button className={action === "approve" ? `${styles.actionButton} ${styles.actionButtonPrimary}` : action === "suspend" || action === "reject" ? `${styles.actionButton} ${styles.actionButtonDanger}` : styles.actionButton} disabled={busy || !reasonCode.trim()} key={action} onClick={() => void act(action)} type="button">{({ approve: "Approve", "request-changes": "Request changes", reject: "Reject", suspend: "Suspend" } as const)[action]}</button>)}
    </div>
    <ActionMessage error={failed} message={message} />
  </div>;
}

export function CatalogMediaReviewActions({
  assetId,
  actions,
}: {
  assetId: string;
  actions: readonly Extract<RequestAction, "approve" | "quarantine" | "reject">[];
}) {
  const router = useRouter();
  const [reasonCode, setReasonCode] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(action: typeof actions[number]) {
    setBusy(true); setFailed(false); setMessage("Recording media review evidence…");
    try {
      await submit(`/api/admin/catalog/media/${encodeURIComponent(assetId)}/${action}`, { operationId: operationId("catalog-media"), reasonCode: reasonCode.trim().toLocaleUpperCase("en-ZA").replace(/[^A-Z0-9]+/g, "_") });
      setMessage("Media review evidence was recorded. Refreshing the source-backed record…");
      router.refresh();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "The media review request failed.");
    } finally { setBusy(false); }
  }

  if (!actions.length) return <p className={styles.note}>This media record is read-only for the current administrator or has no eligible review transition.</p>;
  return <div className={styles.actionForm}>
    <label htmlFor="commerce-media-reason">Reason code
      <input aria-describedby="commerce-media-reason-help" id="commerce-media-reason" maxLength={80} onChange={(event) => setReasonCode(event.target.value)} placeholder="REVIEWED_MEDIA_EVIDENCE" value={reasonCode} />
    </label>
    <p className={styles.note} id="commerce-media-reason-help">A reason code is required for every canonical media review action.</p>
    <div className={styles.actionRow}>
      {actions.map((action) => <button className={action === "approve" ? `${styles.actionButton} ${styles.actionButtonPrimary}` : action === "reject" ? `${styles.actionButton} ${styles.actionButtonDanger}` : styles.actionButton} disabled={busy || !reasonCode.trim()} key={action} onClick={() => void act(action)} type="button">{({ approve: "Approve ready", quarantine: "Quarantine", reject: "Reject" } as const)[action]}</button>)}
    </div>
    <ActionMessage error={failed} message={message} />
  </div>;
}

function lifecycleAction(status: StorefrontLifecycleStatus, locked: boolean): "submit" | "approve" | "reject" | "retire" | undefined {
  if (status === "DRAFT") return "submit";
  if (status === "UNDER_REVIEW") return "approve";
  if (status === "ACTIVE") return "retire";
  if (status === "APPROVED" && !locked) return undefined;
  return undefined;
}

export function StorefrontLifecycleActions({ basePath, reference, version, status, canManage, publicExposureLocked }: {
  basePath: string;
  reference: string;
  version: number;
  status: StorefrontLifecycleStatus;
  canManage: boolean;
  publicExposureLocked: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const primary = lifecycleAction(status, publicExposureLocked);
  const actions = [primary, ...(status === "UNDER_REVIEW" ? ["reject" as const] : [])].filter((action): action is NonNullable<typeof action> => Boolean(action));

  async function act(action: typeof actions[number]) {
    setBusy(true); setFailed(false); setMessage("Recording lifecycle evidence…");
    try {
      await submit(`${basePath}/${encodeURIComponent(reference)}/${action}`, { version, operationId: operationId("storefront-lifecycle") });
      setMessage("Lifecycle evidence was recorded. Refreshing the source-backed record…");
      router.refresh();
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "The lifecycle request failed.");
    } finally { setBusy(false); }
  }

  if (!canManage) return <p className={styles.note}>Read-only access. Lifecycle changes are unavailable.</p>;
  return <div className={styles.actionForm}>
    {actions.length ? <div className={styles.actionRow}>{actions.map((action) => <button className={action === "approve" ? `${styles.actionButton} ${styles.actionButtonPrimary}` : action === "reject" ? `${styles.actionButton} ${styles.actionButtonDanger}` : styles.actionButton} disabled={busy} key={action} onClick={() => void act(action)} type="button">{({ submit: "Submit for review", approve: "Approve", reject: "Reject", retire: "Retire" } as const)[action]}</button>)}</div> : <p className={styles.note}>{status === "APPROVED" && publicExposureLocked ? "Public activation is unavailable while storefront exposure remains locked." : "No lifecycle transition is currently eligible."}</p>}
    <ActionMessage error={failed} message={message} />
  </div>;
}

export function StorefrontProjectionActions({ reference, version, canReconcile, resolved }: { reference: string; version: number; canReconcile: boolean; resolved: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function act(action: "rebuild" | "resolve") {
    setBusy(true); setFailed(false); setMessage("Submitting the canonical projection request…");
    try {
      await submit(`/api/admin/storefront/projections/${encodeURIComponent(reference)}/${action}`, { version, operationId: operationId("storefront-projection") });
      setMessage("The canonical projection request was recorded. Refreshing the source-backed record…");
      router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "The projection request failed."); } finally { setBusy(false); }
  }
  if (!canReconcile) return <p className={styles.note}>Read-only access. Canonical projection reconciliation is unavailable.</p>;
  if (resolved) return <p className={styles.note}>This resolved record is immutable historical evidence.</p>;
  return <div className={styles.actionForm}><div className={styles.actionRow}><button className={styles.actionButton} disabled={busy} onClick={() => void act("rebuild")} type="button">Request canonical rebuild</button><button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} disabled={busy} onClick={() => void act("resolve")} type="button">Resolve after coherence</button></div><ActionMessage error={failed} message={message} /></div>;
}

export function StorefrontCollectionCreateForm({ canManage }: { canManage: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setFailed(false); setMessage("Creating the canonical collection draft…");
    try { await submit("/api/admin/storefront/collections", { name: String(form.get("name") ?? ""), slug: String(form.get("slug") ?? ""), collectionType: String(form.get("collectionType") ?? "EDITORIAL"), operationId: operationId("storefront-collection") }); setMessage("Collection draft created. Refreshing the source-backed list…"); event.currentTarget.reset(); router.refresh(); } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "The collection draft could not be created."); } finally { setBusy(false); }
  }
  if (!canManage) return <p className={styles.note}>Read-only access. Collection drafts cannot be created.</p>;
  return <form className={styles.actionForm} onSubmit={(event) => void create(event)}><label htmlFor="collection-name">Name<input id="collection-name" maxLength={160} name="name" required /></label><label htmlFor="collection-slug">Slug<input id="collection-slug" maxLength={100} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label><label htmlFor="collection-type">Collection type<select defaultValue="EDITORIAL" id="collection-type" name="collectionType"><option value="EDITORIAL">Editorial</option><option value="SEASONAL">Seasonal</option><option value="CATEGORY_LANDING">Category landing</option></select></label><div className={styles.actionRow}><button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} disabled={busy} type="submit">Create draft</button></div><ActionMessage error={failed} message={message} /></form>;
}

export function StorefrontCollectionItemForm({ reference, version, canManage }: { reference: string; version: number; canManage: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setFailed(false); setMessage("Adding canonical collection evidence…");
    try { await submit(`/api/admin/storefront/collections/${encodeURIComponent(reference)}/items`, { version, targetType: String(form.get("targetType") ?? "PRODUCT"), targetReference: String(form.get("targetReference") ?? ""), displayOrder: Number(form.get("displayOrder") ?? 0), safeLabelOverride: String(form.get("label") ?? "") || undefined, operationId: operationId("storefront-collection-item") }); setMessage("Collection evidence was added. Refreshing the source-backed record…"); event.currentTarget.reset(); router.refresh(); } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "The collection item could not be added."); } finally { setBusy(false); }
  }
  if (!canManage) return <p className={styles.note}>Read-only access. Collection items cannot be added.</p>;
  return <form className={styles.actionForm} onSubmit={(event) => void add(event)}><label htmlFor="collection-target-type">Target type<select id="collection-target-type" name="targetType"><option value="CATEGORY">Category</option><option value="PRODUCT">Product</option><option value="VARIANT">Variant</option><option value="STORE">Store</option></select></label><label htmlFor="collection-target-reference">Public reference<input id="collection-target-reference" maxLength={160} name="targetReference" required /></label><label htmlFor="collection-display-order">Display order<input defaultValue="0" id="collection-display-order" min="0" name="displayOrder" required type="number" /></label><label htmlFor="collection-label">Editorial label<input id="collection-label" maxLength={240} name="label" /></label><div className={styles.actionRow}><button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} disabled={busy} type="submit">Add eligible item</button></div><ActionMessage error={failed} message={message} /></form>;
}

export function StorefrontSynonymCreateForm({ canManage }: { canManage: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false); const [busy, setBusy] = useState(false);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const input = String(form.get("input") ?? ""); const output = String(form.get("output") ?? ""); setBusy(true); setFailed(false); setMessage("Creating the deterministic synonym draft…");
    try { await submit("/api/admin/storefront/search-synonyms", { name: String(form.get("name") ?? ""), language: String(form.get("language") ?? "en-ZA"), terms: [{ input, outputs: [output], direction: String(form.get("direction") ?? "EQUIVALENT") }], operationId: operationId("storefront-synonym") }); setMessage("Synonym draft created. Refreshing the source-backed list…"); event.currentTarget.reset(); router.refresh(); } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "The synonym draft could not be created."); } finally { setBusy(false); }
  }
  if (!canManage) return <p className={styles.note}>Read-only access. Synonym drafts cannot be created.</p>;
  return <form className={styles.actionForm} onSubmit={(event) => void create(event)}><label htmlFor="synonym-name">Set name<input id="synonym-name" maxLength={120} name="name" required /></label><label htmlFor="synonym-language">Language<input defaultValue="en-ZA" id="synonym-language" maxLength={10} name="language" pattern="[a-z]{2,3}(-[A-Z]{2})?" required /></label><label htmlFor="synonym-input">Input term<input id="synonym-input" maxLength={120} name="input" required /></label><label htmlFor="synonym-output">Output term<input id="synonym-output" maxLength={120} name="output" required /></label><label htmlFor="synonym-direction">Direction<select defaultValue="EQUIVALENT" id="synonym-direction" name="direction"><option value="EQUIVALENT">Equivalent</option><option value="ONE_WAY">One way</option></select></label><p className={styles.note}>Terms are validated on the server. Rules remain deterministic data; executable rules and automatic activation are unavailable.</p><div className={styles.actionRow}><button className={`${styles.actionButton} ${styles.actionButtonPrimary}`} disabled={busy} type="submit">Create synonym draft</button></div><ActionMessage error={failed} message={message} /></form>;
}
