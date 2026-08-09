"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface LegalDocumentVersionItem {
  id: string;
  publicReference: string;
  documentType: string;
  version: string;
  jurisdiction: string;
  contentHash: string;
  publicationStatus: string;
  effectiveAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  acceptancesCount?: number;
}

interface LegalDocumentsManagerProps {
  initialDocuments: LegalDocumentVersionItem[];
}

export function LegalDocumentsManager({ initialDocuments }: LegalDocumentsManagerProps) {
  const [documents, setDocuments] = useState<LegalDocumentVersionItem[]>(initialDocuments);
  const [loading, setLoading] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [activeDoc, setActiveDoc] = useState<LegalDocumentVersionItem | null>(null);

  // Form state for draft
  const [documentType, setDocumentType] = useState("TERMS_OF_SERVICE");
  const [versionStr, setVersionStr] = useState("1.0.0");
  const [jurisdiction, setJurisdiction] = useState("ZA");
  const [rawContent, setRawContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form state for publishing
  const [publishing, setPublishing] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/legal-documents");
      const json = await res.json();
      if (json.data) setDocuments(json.data);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }

  async function calculateSha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleCreateDraft() {
    if (!rawContent.trim()) {
      setCreateError("Legal document content cannot be empty.");
      return;
    }
    setCreating(true);
    setCreateError(null);

    try {
      const contentHash = await calculateSha256(rawContent);

      const res = await fetch("/api/admin/legal-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          version: versionStr,
          jurisdiction,
          contentHash,
          acceptancePolicy: "MANDATORY_EXPLICIT_CHECK",
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setCreateError(json.error || "Failed to create legal document draft");
        return;
      }

      setShowDraftModal(false);
      setRawContent("");
      await fetchDocuments();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Draft creation error");
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish() {
    if (!activeDoc || publishConfirm !== "PUBLISH") return;
    setPublishing(true);
    setPublishError(null);

    const operationId = `LEGALOP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const res = await fetch(`/api/admin/legal-documents/${activeDoc.publicReference}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId,
          confirmPublication: "PUBLISH",
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setPublishError(json.error || "Failed to publish legal document version");
        return;
      }

      setActiveDoc(json.data);
      setPublishConfirm("");
      await fetchDocuments();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Publish error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[--kt-surface] border border-[--kt-border] rounded-xl p-4">
        <div>
          <h3 className="text-base font-bold text-[--kt-text]">Legal Document & Terms Governance</h3>
          <p className="text-xs text-[--kt-text-muted]">
            Author immutable legal document versions with SHA-256 terms hashing, publication controls, and acceptance tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchDocuments} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowDraftModal(true)}>
            Create Draft Version
          </Button>
        </div>
      </div>

      <div className="border border-[--kt-border] rounded-xl overflow-hidden bg-[--kt-surface]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[--kt-surface-muted] border-b border-[--kt-border] text-xs font-semibold text-[--kt-text-muted]">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Document Type</th>
              <th className="p-3">Version</th>
              <th className="p-3">Jurisdiction</th>
              <th className="p-3">Status</th>
              <th className="p-3">Content Hash</th>
              <th className="p-3">Published</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--kt-border]">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-xs text-[--kt-text-muted]">
                  No legal document versions found.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.publicReference} className="hover:bg-[--kt-surface-muted]/50">
                  <td className="p-3 font-mono text-xs font-bold">{doc.publicReference}</td>
                  <td className="p-3 text-xs font-semibold">{doc.documentType}</td>
                  <td className="p-3 font-mono text-xs">{doc.version}</td>
                  <td className="p-3 font-mono text-xs">{doc.jurisdiction}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        doc.publicationStatus === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {doc.publicationStatus}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-[--kt-text-muted] max-w-[120px] truncate">
                    {doc.contentHash}
                  </td>
                  <td className="p-3 text-xs text-[--kt-text-muted]">
                    {doc.publishedAt ? new Date(doc.publishedAt).toLocaleDateString() : "Draft"}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setActiveDoc(doc)}>
                      Inspect / Publish
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Draft Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Create Legal Document Draft</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                >
                  <option value="TERMS_OF_SERVICE">TERMS_OF_SERVICE</option>
                  <option value="PRIVACY_POLICY">PRIVACY_POLICY</option>
                  <option value="DRIVER_PARTNER_AGREEMENT">DRIVER_PARTNER_AGREEMENT</option>
                  <option value="STORE_MERCHANT_AGREEMENT">STORE_MERCHANT_AGREEMENT</option>
                  <option value="PROMOTER_AGREEMENT">PROMOTER_AGREEMENT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Version</label>
                <Input value={versionStr} onChange={(e) => setVersionStr(e.target.value)} placeholder="e.g. 1.1.0" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Jurisdiction</label>
              <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. ZA" />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Legal Terms Text (SHA-256 hash computed on draft)</label>
              <Textarea
                rows={5}
                placeholder="Paste legal document text content here..."
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
              />
            </div>

            {createError && <p className="text-xs text-red-600 font-semibold">{createError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowDraftModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={!rawContent || creating} onClick={handleCreateDraft}>
                {creating ? "Creating..." : "Create Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Publish Modal */}
      {activeDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[--kt-border] pb-3">
              <div>
                <h3 className="text-lg font-bold font-mono">{activeDoc.publicReference}</h3>
                <p className="text-xs text-[--kt-text-muted]">
                  Type: {activeDoc.documentType} | Version: {activeDoc.version} | Status: {activeDoc.publicationStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDoc(null)}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="text-xs space-y-1 bg-[--kt-surface-muted] p-3 rounded font-mono">
              <p><span className="font-semibold font-sans">Content Hash:</span> {activeDoc.contentHash}</p>
              <p><span className="font-semibold font-sans">Jurisdiction:</span> {activeDoc.jurisdiction}</p>
              <p><span className="font-semibold font-sans">Created:</span> {new Date(activeDoc.createdAt).toLocaleString()}</p>
            </div>

            {activeDoc.publicationStatus === "DRAFT" ? (
              <div className="border border-[--kt-border] p-4 rounded-xl space-y-3">
                <h4 className="font-bold text-xs uppercase text-[--kt-text-muted]">Publish Immutable Version</h4>
                <p className="text-xs text-[--kt-text-muted]">
                  Publishing locks this legal document version with its terms content hash. Published versions cannot be modified.
                </p>

                <div>
                  <label className="block text-xs font-semibold mb-1">Type &apos;PUBLISH&apos; to confirm</label>
                  <Input
                    placeholder="PUBLISH"
                    value={publishConfirm}
                    onChange={(e) => setPublishConfirm(e.target.value)}
                  />
                </div>

                {publishError && <p className="text-xs text-red-600 font-semibold">{publishError}</p>}

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={publishConfirm !== "PUBLISH" || publishing}
                    onClick={handlePublish}
                  >
                    {publishing ? "Publishing..." : "Publish Version"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded text-xs">
                <span className="font-bold">Published & Immutable</span> — Published on{" "}
                {activeDoc.publishedAt ? new Date(activeDoc.publishedAt).toLocaleString() : "Record"}.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
