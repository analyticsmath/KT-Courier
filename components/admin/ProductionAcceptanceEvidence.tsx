"use client";
import { useState } from "react";
import { parseEvidenceUtcInput } from "@/lib/production-readiness/evidence-time";
import { useRouter } from "next/navigation";
import type { AcceptanceRecord } from "@/lib/production-readiness/evidence";
import type { QaFunctionalRecord } from "@/lib/production-readiness/qa-functional-evidence";
import {
  acceptanceKeys,
  qaFunctionalKeys,
  requiresFinancialAuthorizationReference,
} from "@/lib/production-readiness/acceptance-keys";

const COMMERCIAL_KEYS = acceptanceKeys;
const QA_KEYS = qaFunctionalKeys;

export function ProductionAcceptanceEvidence({
  records,
  qaRecords = [],
  canManage,
}: {
  records: AcceptanceRecord[];
  qaRecords?: QaFunctionalRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState<string>(COMMERCIAL_KEYS[0]);
  const [paymentMode, setPaymentMode] = useState("SANDBOX");
  const [qaKey, setQaKey] = useState<string>(QA_KEYS[0]);
  const [message, setMessage] = useState("");
  const [qaMessage, setQaMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const needsFinancialAuth =
    (key === "payment_integration_acceptance" && paymentMode === "LIVE") ||
    (key !== "payment_integration_acceptance" && requiresFinancialAuthorizationReference(key));

  async function submitCommercial(form: HTMLFormElement, review?: AcceptanceRecord, action?: "APPROVE" | "REVOKE") {
    const f = new FormData(form);
    setBusy(true);
    setMessage("");
    const field = (name: string) => String(f.get(name) ?? "");
    const kind =
      key === "current_ci_certification"
        ? "CI"
        : key === "production_deployment_sha_parity"
          ? "PARITY"
          : key === "payment_integration_acceptance"
            ? paymentMode
            : "LIVE";
    try {
      const evidence = review
        ? null
        : {
            kind,
            key,
            releaseSha: field("releaseSha"),
            observedAt: parseEvidenceUtcInput(field("observedAt")),
            expiresAt: parseEvidenceUtcInput(field("expiresAt")),
            evidenceReference: field("evidenceReference"),
            reason: field("reason"),
            ...(kind === "SANDBOX"
              ? {
                  genuineOperatorAcceptance: true,
                  provider: "PAYSTACK",
                  paymentReference: field("paymentReference"),
                  amount: field("amount"),
                  currency: "ZAR",
                }
              : kind === "CI"
                ? {
                    runUrl: field("runUrl"),
                    conclusion: "SUCCESS",
                    skippedCriticalTests: 0,
                    testsPassed: Number(field("testsPassed")),
                  }
                : kind === "PARITY"
                  ? {
                      ...Object.fromEntries(
                        [
                          "vercelSha",
                          "webSha",
                          "operationsSha",
                          "querySha",
                          "vercelDeploymentId",
                          "webDeploymentId",
                          "operationsDeploymentId",
                          "queryDeploymentId",
                          "protectedDataAuditReference",
                        ].map((name) => [name, field(name)]),
                      ),
                      protectedDataUnchanged: true,
                    }
                  : {
                      genuineOperatorAcceptance: true,
                      financialAuthorizationReference: needsFinancialAuth ? field("financialAuthorizationReference") || null : null,
                    }),
          };
      const body = review
        ? { key: review.evidence.key, expectedVersion: review.version, action, reason: field("reason") }
        : { evidence, expectedVersion: records.find((r) => r.evidence.key === key)?.version ?? 0 };
      const r = await fetch("/api/admin/production-readiness", {
        method: review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Evidence could not be saved.");
      setMessage(review ? "Commercial evidence review recorded." : "Commercial draft saved. Independent review is required.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function submitQaFunctional(form: HTMLFormElement, review?: QaFunctionalRecord, action?: "APPROVE" | "REVOKE") {
    const f = new FormData(form);
    setBusy(true);
    setQaMessage("");
    const field = (name: string) => String(f.get(name) ?? "").trim();
    try {
      const body = review
        ? {
            kind: "QA_FUNCTIONAL",
            key: review.key,
            expectedVersion: review.version,
            action,
            reason: field("reason"),
          }
        : {
            kind: "QA_FUNCTIONAL",
            key: qaKey,
            releaseSha: field("releaseSha"),
            qaRunReference: field("qaRunReference"),
            evidenceReference: field("evidenceReference"),
            ...(field("orderNumber") ? { orderNumber: field("orderNumber") } : {}),
            ...(field("paymentReference") ? { paymentReference: field("paymentReference") } : {}),
            reason: field("reason"),
            expectedVersion: qaRecords.find((r) => r.key === qaKey)?.version ?? 0,
          };
      const r = await fetch("/api/admin/production-readiness", {
        method: review ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "QA functional acceptance could not be saved.");
      setQaMessage(
        review
          ? "QA functional acceptance review recorded (non-commercial)."
          : "Server-verified QA functional draft saved. Independent review required.",
      );
      router.refresh();
    } catch (error) {
      setQaMessage(error instanceof Error ? error.message : "QA functional acceptance could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const input = (name: string, label: string, type = "text", required = true) => (
    <label className="grid gap-2 text-sm" key={name}>
      <span className="font-medium">{label}</span>
      <input className="min-h-11 rounded border border-[var(--kt-border)] bg-transparent p-2" name={name} type={type} required={required} />
    </label>
  );

  return (
    <section id="acceptance-evidence" className="mt-8 space-y-6 scroll-mt-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Acceptance evidence: Commercial live vs QA functional</h2>
        <p className="text-sm text-[var(--kt-text-muted)]">
          Commercial Live obligations and isolated QA functional acceptance are tracked side by side without conflation. QA functional checks are server-verified against isolated QARUN records and never unlock commercial live launch gates or live payouts.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-[var(--kt-border)] p-5">
          <div className="space-y-1">
            <span className="inline-block rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              COMMERCIAL LIVE OBLIGATIONS
            </span>
            <h3 className="text-lg font-semibold">Commercial production acceptance</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">
              Separate financial authorization references are required only for monetary acceptance keys (payment integration LIVE mode, settlement, refund, payout) and are not required for operational workflow checks (vendor onboarding, driver onboarding, driver GPS, POD/OTP).
            </p>
          </div>

          {canManage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitCommercial(e.currentTarget);
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="font-medium">Commercial capability</span>
                <select
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="min-h-11 rounded border border-[var(--kt-border)] bg-transparent p-2"
                >
                  {COMMERCIAL_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k === "payment_integration_acceptance" ? "payment integration acceptance" : k.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              {key === "payment_integration_acceptance" && (
                <label className="grid gap-2 text-sm sm:col-span-2">
                  <span className="font-medium">Payment evidence mode</span>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="min-h-11 rounded border border-[var(--kt-border)] bg-transparent p-2"
                  >
                    <option value="SANDBOX">Verified Paystack sandbox payment</option>
                    <option value="LIVE">Previously completed live payment</option>
                  </select>
                </label>
              )}

              {input("releaseSha", "Release commit SHA")}
              {input("evidenceReference", "Evidence artifact reference")}
              {input("observedAt", "Observed at (UTC)", "datetime-local")}
              {input("expiresAt", "Review expires at (UTC)", "datetime-local")}

              {key === "payment_integration_acceptance" && paymentMode === "SANDBOX" ? (
                <>
                  {input("paymentReference", "Verified sandbox payment reference")}
                  {input("amount", "Verified amount (ZAR, e.g. 148.35)")}
                  <p className="text-xs text-[var(--kt-text-muted)] sm:col-span-2">
                    Server verifies Paystack test attempt, ZAR amount, and ledger confirmation without moving live money.
                  </p>
                </>
              ) : key === "current_ci_certification" ? (
                <>
                  {input("runUrl", "Successful certification run URL", "url")}
                  {input("testsPassed", "Passed tests (zero critical skips)", "number")}
                </>
              ) : key === "production_deployment_sha_parity" ? (
                <>
                  {[
                    "vercelSha",
                    "webSha",
                    "operationsSha",
                    "querySha",
                    "vercelDeploymentId",
                    "webDeploymentId",
                    "operationsDeploymentId",
                    "queryDeploymentId",
                    "protectedDataAuditReference",
                  ].map((n) => input(n, n.replace(/([A-Z])/g, " $1")))}
                  <p className="text-xs text-[var(--kt-text-muted)] sm:col-span-2">
                    Confirm Vercel and Railway deployments (`web`, `operations`, `query-storefront-categories`) match the release SHA and protected rows are unchanged.
                  </p>
                </>
              ) : needsFinancialAuth ? (
                <div className="sm:col-span-2">
                  {input("financialAuthorizationReference", "Separate financial authorization reference (required)")}
                </div>
              ) : (
                <p className="rounded border border-[var(--kt-border)] p-2 text-xs text-[var(--kt-text-muted)] sm:col-span-2">
                  Operational LIVE check: separate financial authorization reference is not required.
                </p>
              )}

              <div className="sm:col-span-2">{input("reason", "Evidence summary and reason")}</div>
              <label className="flex items-start gap-2 text-xs sm:col-span-2">
                <input required type="checkbox" className="mt-0.5" />
                <span>I verified the referenced commercial evidence and completed the genuine acceptance check.</span>
              </label>
              <button disabled={busy} className="min-h-11 rounded border border-[var(--kt-border)] px-4 font-medium sm:col-span-2">
                Save commercial draft
              </button>
            </form>
          )}

          {message && (
            <p role="status" className="text-sm font-medium">
              {message}
            </p>
          )}

          <div className="space-y-3 pt-2">
            {records.map((record) => (
              <article key={record.evidence.key} className="rounded border border-[var(--kt-border)] p-4 text-sm">
                <h4 className="font-semibold">
                  {record.evidence.key === "payment_integration_acceptance"
                    ? "payment integration acceptance"
                    : record.evidence.key.replaceAll("_", " ")}
                </h4>
                <p className="text-xs text-[var(--kt-text-muted)]">
                  {record.status} · v{record.version} · release {record.evidence.releaseSha.slice(0, 12)}
                </p>
                <p className="text-xs text-[var(--kt-text-muted)]">
                  Mode: {record.evidence.kind} · Verification: {record.verificationMode ?? "UNSPECIFIED"}
                </p>
                <p className="text-xs">Ref: {record.evidence.evidenceReference}</p>
                {record.evidence.kind === "LIVE" && record.evidence.financialAuthorizationReference && (
                  <p className="text-xs">Financial auth: {record.evidence.financialAuthorizationReference}</p>
                )}
                {canManage && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "REVOKE" ? "REVOKE" : "APPROVE";
                      void submitCommercial(e.currentTarget, record, action);
                    }}
                    className="mt-3 grid gap-2"
                  >
                    {input("reason", "Review or revocation reason")}
                    <div className="flex flex-wrap gap-2">
                      {record.status === "DRAFT" && (
                        <button value="APPROVE" disabled={busy} className="min-h-10 rounded border border-[var(--kt-border)] px-3 text-xs font-medium">
                          Independently approve evidence
                        </button>
                      )}
                      <button value="REVOKE" disabled={busy} className="min-h-10 rounded border border-[var(--kt-border)] px-3 text-xs">
                        Revoke evidence
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--kt-border)] p-5">
          <div className="space-y-1">
            <span className="inline-block rounded bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
              SERVER_VERIFIED QA FUNCTIONAL (NON-COMMERCIAL)
            </span>
            <h3 className="text-lg font-semibold">Isolated QA workflow acceptance</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">
              Verified directly by the server against isolated `QARUN-*` database evidence (`commercialLiveEquivalent: false`). Passing these workflows proves engineering & QA functionality without claiming commercial live equivalence.
            </p>
          </div>

          {canManage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitQaFunctional(e.currentTarget);
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="font-medium">QA workflow check</span>
                <select
                  value={qaKey}
                  onChange={(e) => setQaKey(e.target.value)}
                  className="min-h-11 rounded border border-[var(--kt-border)] bg-transparent p-2"
                >
                  {QA_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              {input("releaseSha", "Release commit SHA")}
              {input("qaRunReference", "QA run reference (QARUN-...)")}
              {input("evidenceReference", "Evidence artifact reference")}
              {input("orderNumber", "Order number (optional)", "text", false)}
              {input("paymentReference", "Payment reference (optional)", "text", false)}
              {input("reason", "Verification summary and reason")}

              <button disabled={busy} className="min-h-11 rounded border border-[var(--kt-border)] px-4 font-medium sm:col-span-2">
                Verify & save QA functional draft
              </button>
            </form>
          )}

          {qaMessage && (
            <p role="status" className="text-sm font-medium">
              {qaMessage}
            </p>
          )}

          <div className="space-y-3 pt-2">
            {qaRecords.length === 0 ? (
              <p className="text-xs text-[var(--kt-text-muted)]">No QA functional acceptance records saved yet.</p>
            ) : (
              qaRecords.map((record) => (
                <article key={record.key} className="rounded border border-[var(--kt-border)] p-4 text-sm">
                  <h4 className="font-semibold">{record.key.replaceAll("_", " ")}</h4>
                  <p className="text-xs text-[var(--kt-text-muted)]">
                    {record.status} · v{record.version} · {record.verificationMode} · non-commercial ({String(record.commercialLiveEquivalent)})
                  </p>
                  <p className="text-xs">
                    Run: {record.qaRunReference} · SHA: {record.releaseSha.slice(0, 12)} · Ref: {record.evidenceReference}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-[11px] dark:bg-white/5">
                    {JSON.stringify(record.verifiedFacts, null, 2)}
                  </pre>
                  {canManage && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "REVOKE" ? "REVOKE" : "APPROVE";
                        void submitQaFunctional(e.currentTarget, record, action);
                      }}
                      className="mt-3 grid gap-2"
                    >
                      {input("reason", "QA review or revocation reason")}
                      <div className="flex flex-wrap gap-2">
                        {record.status === "DRAFT" && (
                          <button value="APPROVE" disabled={busy} className="min-h-10 rounded border border-[var(--kt-border)] px-3 text-xs font-medium">
                            Independently approve QA check
                          </button>
                        )}
                        <button value="REVOKE" disabled={busy} className="min-h-10 rounded border border-[var(--kt-border)] px-3 text-xs">
                          Revoke QA check
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
