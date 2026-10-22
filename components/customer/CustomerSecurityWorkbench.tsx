"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

function generatePrivacyOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    const raw = crypto.randomUUID().replaceAll("-", "").toUpperCase();
    return `DSAROP-${raw.substring(0, 16)}`;
  }
  return "DSAROP-REQUEST001";
}

export interface SecurityUserDto {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SecuritySessionDto {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface SecurityLoginHistoryDto {
  id: string;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SecurityPrivacyRequestDto {
  id: string;
  publicReference: string;
  requestType: string;
  status: string;
  identityVerificationStatus: string;
  decision: string | null;
  createdAt: string;
}

interface CustomerSecurityWorkbenchProps {
  user: SecurityUserDto;
  initialSessions: SecuritySessionDto[];
  initialLoginHistory: SecurityLoginHistoryDto[];
  initialPrivacyRequests: SecurityPrivacyRequestDto[];
}

const PRIVACY_REQUEST_TYPES = [
  { value: "ACCESS", label: "Access — Request copy of all personal data held" },
  { value: "CORRECTION", label: "Correction — Request rectification of inaccurate information" },
  { value: "DELETION_OR_ANONYMISATION", label: "Deletion — Request erasure or anonymisation of data" },
  { value: "OBJECTION", label: "Objection — Object to processing under POPIA section 11(3)" },
  { value: "CONSENT_WITHDRAWAL", label: "Consent Withdrawal — Withdraw optional processing consent" },
  { value: "PORTABILITY", label: "Portability — Export personal data in structured format" },
] as const;

export function CustomerSecurityWorkbench({
  user,
  initialSessions,
  initialLoginHistory,
  initialPrivacyRequests,
}: CustomerSecurityWorkbenchProps) {
  const [sessions, setSessions] = useState<SecuritySessionDto[]>(initialSessions);
  const [privacyRequests, setPrivacyRequests] = useState<SecurityPrivacyRequestDto[]>(initialPrivacyRequests);

  // Session state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);

  // Privacy request form state
  const [requestType, setRequestType] = useState<string>("ACCESS");
  const [scopeDetails, setScopeDetails] = useState<string>("");
  const [submittingPrivacy, setSubmittingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySuccess, setPrivacySuccess] = useState<string | null>(null);

  async function handleRevokeSession(sessionId: string) {
    setSessionError(null);
    setSessionSuccess(null);
    setRevokingId(sessionId);

    try {
      const res = await fetch("/api/account/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, reason: "CUSTOMER_MANUAL_REVOKE" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to revoke session.");
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, revokedAt: new Date().toISOString(), revokedReason: "CUSTOMER_MANUAL_REVOKE" } : s
        )
      );
      setSessionSuccess("Session revoked successfully.");
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "Revocation failed.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleRevokeAllOthers() {
    setSessionError(null);
    setSessionSuccess(null);
    setRevokingId("all-others");

    try {
      const res = await fetch("/api/account/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAllOthers: true, reason: "CUSTOMER_REVOKED_ALL_OTHERS" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to revoke sessions.");
      }

      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          revokedAt: s.revokedAt || new Date().toISOString(),
          revokedReason: s.revokedReason || "CUSTOMER_REVOKED_ALL_OTHERS",
        }))
      );
      setSessionSuccess("All other sessions revoked successfully.");
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "Revocation failed.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleSubmitPrivacyRequest(e: React.FormEvent) {
    e.preventDefault();
    setPrivacyError(null);
    setPrivacySuccess(null);
    setSubmittingPrivacy(true);

    const operationId = generatePrivacyOperationId();

    try {
      const res = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          scope: scopeDetails.trim() ? [scopeDetails.trim().substring(0, 80)] : undefined,
          requestContext: scopeDetails.trim() ? { details: scopeDetails.trim().substring(0, 240) } : undefined,
          operationId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to submit privacy request.");
      }

      const responseJson = await res.json();
      const created = responseJson.data;

      if (created) {
        setPrivacyRequests((prev) => [
          {
            id: created.id,
            publicReference: created.publicReference,
            requestType: created.requestType,
            status: created.status || "RECEIVED",
            identityVerificationStatus: created.identityVerificationStatus || "REQUIRED",
            decision: created.decision || null,
            createdAt: created.createdAt || new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      setPrivacySuccess(`Privacy request submitted successfully. Reference: ${created?.publicReference || operationId}`);
      setScopeDetails("");
    } catch (err: unknown) {
      setPrivacyError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmittingPrivacy(false);
    }
  }

  const activeSessionsCount = sessions.filter((s) => !s.revokedAt && new Date(s.expiresAt) > new Date()).length;

  return (
    <div className="space-y-8">
      {/* Account Security Overview */}
      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--kt-brand-navy)]">Security Credentials & Profile</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">Verified identity and authentication credentials</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/forgot-password"
              className="inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-medium text-[var(--kt-brand-blue)]  transition-colors"
            >
              Reset / Change Password
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-[var(--kt-surface-muted)] space-y-1">
            <span className="text-xs text-[var(--kt-text-muted)]">Primary Email</span>
            <div className="font-medium text-sm text-[var(--kt-brand-navy)] break-all">{user.email}</div>
            <div className="pt-1">
              {user.emailVerifiedAt ? (
                <Badge variant="green">Verified</Badge>
              ) : (
                <Badge variant="amber">Pending Verification</Badge>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--kt-surface-muted)] space-y-1">
            <span className="text-xs text-[var(--kt-text-muted)]">Account Role & Status</span>
            <div className="font-medium text-sm text-[var(--kt-brand-navy)] capitalize">
              {user.role.toLowerCase().replaceAll("_", " ")}
            </div>
            <div className="pt-1">
              <Badge variant={user.status === "ACTIVE" ? "green" : "amber"}>{user.status}</Badge>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[var(--kt-surface-muted)] space-y-1">
            <span className="text-xs text-[var(--kt-text-muted)]">Active Login Sessions</span>
            <div className="font-medium text-sm text-[var(--kt-brand-navy)]">
              {activeSessionsCount} active {activeSessionsCount === 1 ? "device" : "devices"}
            </div>
            <div className="pt-1 text-xs text-[var(--kt-text-muted)]">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--kt-brand-navy)]">Active Device Sessions</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">
              Manage sessions authorized to access your KT Couriers account.
            </p>
          </div>
          {activeSessionsCount > 1 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={Boolean(revokingId)}
              onClick={handleRevokeAllOthers}
            >
              Revoke All Other Sessions
            </Button>
          )}
        </div>

        {sessionSuccess && (
          <div className="p-3 text-xs bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
            {sessionSuccess}
          </div>
        )}
        {sessionError && (
          <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
            {sessionError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b bg-[var(--kt-surface-muted)] text-[var(--kt-text-muted)]">
                <th className="py-2.5 px-3 font-medium">Session ID</th>
                <th className="py-2.5 px-3 font-medium">Created</th>
                <th className="py-2.5 px-3 font-medium">Expires</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[var(--kt-text-muted)]">
                    No active sessions recorded.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const isRevoked = Boolean(session.revokedAt);
                  const isExpired = new Date(session.expiresAt) <= new Date();
                  const isActive = !isRevoked && !isExpired;

                  return (
                    <tr key={session.id} className="">
                      <td className="py-3 px-3 font-mono text-[var(--kt-text-soft)]">
                        {session.id.substring(0, 10)}...
                      </td>
                      <td className="py-3 px-3">{new Date(session.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-3">{new Date(session.expiresAt).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        {isActive ? (
                          <Badge variant="green">Active</Badge>
                        ) : isRevoked ? (
                          <Badge variant="red">Revoked</Badge>
                        ) : (
                          <Badge variant="slate">Expired</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isActive && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={revokingId === session.id}
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Login History */}
      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
        <div className="border-b pb-4">
          <h3 className="text-base font-semibold text-[var(--kt-brand-navy)]">Recent Login Activity</h3>
          <p className="text-xs text-[var(--kt-text-muted)]">
            Log of recent authentication attempts for audit and security monitoring.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b bg-[var(--kt-surface-muted)] text-[var(--kt-text-muted)]">
                <th className="py-2.5 px-3 font-medium">Timestamp</th>
                <th className="py-2.5 px-3 font-medium">Outcome</th>
                <th className="py-2.5 px-3 font-medium">IP Address</th>
                <th className="py-2.5 px-3 font-medium">Client Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialLoginHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--kt-text-muted)]">
                    No recent login activity on record.
                  </td>
                </tr>
              ) : (
                initialLoginHistory.map((item) => (
                  <tr key={item.id} className="">
                    <td className="py-3 px-3 font-mono">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      {item.success ? (
                        <Badge variant="green">Successful</Badge>
                      ) : (
                        <Badge variant="red">{item.failureReason || "Failed"}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[var(--kt-text-soft)]">{item.ipAddress || "—"}</td>
                    <td className="py-3 px-3 text-[var(--kt-text-muted)] max-w-xs truncate" title={item.userAgent || ""}>
                      {item.userAgent || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPIA / Data Privacy Center */}
      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-base font-semibold text-[var(--kt-brand-navy)]">
            POPIA Data Privacy & Subject Rights Center
          </h3>
          <p className="text-xs text-[var(--kt-text-muted)] mt-1">
            Under South Africa&apos;s Protection of Personal Information Act (POPIA), you have statutory rights to inspect,
            rectify, or request deletion of personal information held by KT Couriers (Pty) Ltd.
          </p>
        </div>

        {privacySuccess && (
          <div className="p-3 text-xs bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
            {privacySuccess}
          </div>
        )}
        {privacyError && (
          <div className="p-3 text-xs bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
            {privacyError}
          </div>
        )}

        {/* Submit New Request */}
        <form onSubmit={handleSubmitPrivacyRequest} className="p-4 bg-[var(--kt-surface-muted)] rounded-lg space-y-4">
          <h4 className="text-sm font-semibold text-[var(--kt-brand-navy)]">Submit a Data Subject Request</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="privacy-request-type">Request Type</Label>
              <select
                id="privacy-request-type"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full mt-1 rounded-md border border-[var(--kt-border-strong)] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--kt-brand-blue)]"
              >
                {PRIVACY_REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="privacy-scope-details">Specific Details / Scope (Optional)</Label>
              <Input
                id="privacy-scope-details"
                value={scopeDetails}
                onChange={(e) => setScopeDetails(e.target.value)}
                placeholder="e.g. Inquire regarding delivery address records or marketing emails"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="sm" disabled={submittingPrivacy}>
              {submittingPrivacy ? "Submitting Request..." : "Submit POPIA Request"}
            </Button>
          </div>
        </form>

        {/* Privacy Requests History */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[var(--kt-brand-navy)]">Your Submitted Privacy Requests</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-[var(--kt-surface-muted)] text-[var(--kt-text-muted)]">
                  <th className="py-2.5 px-3 font-medium">Reference</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Verification</th>
                  <th className="py-2.5 px-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {privacyRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[var(--kt-text-muted)]">
                      No privacy requests on record.
                    </td>
                  </tr>
                ) : (
                  privacyRequests.map((req) => (
                    <tr key={req.id} className="">
                      <td className="py-3 px-3 font-mono font-medium text-[var(--kt-brand-blue)]">
                        {req.publicReference}
                      </td>
                      <td className="py-3 px-3 capitalize">{req.requestType.toLowerCase().replaceAll("_", " ")}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            req.status === "COMPLETED"
                              ? "green"
                              : req.status === "REJECTED"
                              ? "red"
                              : "blue"
                          }
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-[var(--kt-text-muted)]">
                        {req.identityVerificationStatus}
                      </td>
                      <td className="py-3 px-3">{new Date(req.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
