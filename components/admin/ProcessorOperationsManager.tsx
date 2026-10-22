"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProtectedDialog } from "@/components/protected-v2/overlays/ProtectedDialog";
import type { RegisteredProcessor } from "@/lib/processors/processor-registry";

interface ProcessorItem extends RegisteredProcessor {
  lastRun?: {
    status?: string;
    startedAt?: string;
    itemsCompleted?: number;
    safeSummary?: string;
    leaseOwner?: string;
    leaseExpiresAt?: string;
  } | null;
}

interface ProcessorOperationsManagerProps {
  processors: ProcessorItem[];
}

type ProcessorExecutionResult = {
  mode: "DRY_RUN" | "APPLY";
  operationId: string;
  itemsExamined: number;
  itemsCompleted: number;
  safeSummary: string;
};

type ProcessorRun = {
  id: string;
  status: string;
  safeSummary?: string | null;
  startedAt: string;
  completedAt?: string | null;
};

export function ProcessorOperationsManager({ processors: initialProcessors }: ProcessorOperationsManagerProps) {
  const [processors, setProcessors] = useState<ProcessorItem[]>(initialProcessors);
  const [loading, setLoading] = useState(false);
  const [selectedProcessor, setSelectedProcessor] = useState<ProcessorItem | null>(null);
  const [executionMode, setExecutionMode] = useState<"DRY_RUN" | "APPLY">("DRY_RUN");
  const [batchSize, setBatchSize] = useState<number>(50);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ProcessorExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<ProcessorRun[] | null>(null);

  async function refreshInventory() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/processors");
      const json = await res.json();
      if (json.data) setProcessors(json.data);
    } catch {
      // Keep existing inventory
    } finally {
      setLoading(false);
    }
  }

  async function fetchRunHistory(processorName: string) {
    try {
      const res = await fetch(`/api/admin/processors/${processorName}/runs`);
      const json = await res.json();
      if (json.data) setRunHistory(json.data);
    } catch {
      setRunHistory([]);
    }
  }

  async function handleExecute() {
    if (!selectedProcessor) return;
    setExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);

    const operationId = `PROCEXEC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const res = await fetch("/api/admin/processors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedProcessor.name,
          mode: executionMode,
          batchSize: Number(batchSize),
          operationId,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setExecutionError(json.error || "Processor execution failed");
        return;
      }

      setExecutionResult(json.data);
      await refreshInventory();
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="kt-processor-workspace space-y-6">
      <div className="kt-processor-workspace__intro">
        <div>
          <h3 className="text-base font-bold text-[--kt-text]">Processor Inventory & Lease Governance</h3>
          <p className="text-xs text-[--kt-text-muted]">
            Standardized operational processor registry, lease ownership, and truthful dry-run / apply execution controls.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refreshInventory} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Inventory"}
        </Button>
      </div>

      <div className="kt-processor-workspace__table" role="region" aria-label="Processor inventory" tabIndex={0}>
        <table className="kt-processor-table">
          <thead className="bg-[--kt-surface-muted] border-b border-[--kt-border] text-xs font-semibold text-[--kt-text-muted]">
            <tr>
              <th className="p-3">Processor Name</th>
              <th className="p-3">Owner Category</th>
              <th className="p-3">Trigger</th>
              <th className="p-3">Classification</th>
              <th className="p-3">Lease Required</th>
              <th className="p-3">Last Run</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--kt-border]">
            {processors.map((p) => {
              const hasActiveLease =
                p.lastRun?.leaseExpiresAt && new Date(p.lastRun.leaseExpiresAt) > new Date();

              return (
                <tr key={p.name} className="hover:bg-[--kt-surface-muted]/50">
                  <td className="p-3">
                    <p className="kt-processor-workspace__name">{p.name}</p>
                    <p className="kt-processor-workspace__purpose">{p.purpose}</p>
                  </td>
                  <td className="p-3 text-xs font-medium text-[--kt-text-muted]">{p.operationalOwnerCategory}</td>
                  <td className="p-3">
                    <span className="kt-processor-workspace__trigger">
                      {p.triggerType}
                    </span>
                  </td>
                  <td className="kt-processor-workspace__classification">{p.classification.replaceAll("_", " ").toLowerCase()}</td>
                  <td className="p-3">
                    {p.leaseRequired ? (
                      <span className={hasActiveLease ? "kt-processor-lease kt-processor-lease--active" : "kt-processor-lease"}>
                        {hasActiveLease ? "Leased" : "Required"}
                      </span>
                    ) : (
                      <span className="kt-processor-workspace__classification">Not required</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {p.lastRun ? (
                      <div>
                        <span className="font-bold text-[10px] uppercase">{p.lastRun.status}</span>
                        <p className="text-[10px] text-[--kt-text-muted]">
                          {p.lastRun.startedAt ? new Date(p.lastRun.startedAt).toLocaleTimeString() : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[--kt-text-muted]">Never run</span>
                    )}
                  </td>
                  <td className="kt-processor-workspace__actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedProcessor(p);
                        setBatchSize(p.defaultBatchSize);
                        setExecutionResult(null);
                        setExecutionError(null);
                        fetchRunHistory(p.name);
                      }}
                    >
                      Configure
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* A real, focus-managed dialog instead of an unscoped translucent overlay. */}
      {selectedProcessor && (
        <ProtectedDialog
          open
          title={selectedProcessor.name}
          description={`Version ${selectedProcessor.version} · ${selectedProcessor.operationalOwnerCategory}`}
          onClose={() => {
            if (executing) return;
            setSelectedProcessor(null);
            setRunHistory(null);
          }}
          closeOnBackdrop={!executing}
          className="kt-processor-dialog"
        >
          <div className="kt-processor-dialog__content">
            <div className="kt-processor-dialog__meta space-y-1">
              <p>
                <span className="font-semibold">Purpose:</span> {selectedProcessor.purpose}
              </p>
              <p>
                <span className="font-semibold">Idempotency Strategy:</span> {selectedProcessor.idempotencyStrategy}
              </p>
              <p>
                <span className="font-semibold">Retry Policy:</span> {selectedProcessor.retryPolicy}
              </p>
            </div>

            {/* Run Trigger Form */}
            <div className="kt-processor-dialog__execute space-y-3">
              <h4 className="font-bold text-xs uppercase text-[--kt-text-muted]">Execute Processor</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="processor-execution-mode" className="block text-xs font-semibold mb-1">Execution mode</label>
                  <select
                    id="processor-execution-mode"
                    value={executionMode}
                    onChange={(e) => setExecutionMode(e.target.value as "DRY_RUN" | "APPLY")}
                    className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                  >
                    <option value="DRY_RUN">DRY RUN (Safely inspect, no mutations)</option>
                    <option value="APPLY">APPLY (Execute mutations & release leases)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="processor-batch-size" className="block text-xs font-semibold mb-1">Batch size (maximum {selectedProcessor.maxBatchSize})</label>
                  <Input
                    id="processor-batch-size"
                    type="number"
                    min={1}
                    max={selectedProcessor.maxBatchSize}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number.parseInt(e.target.value, 10) || 1)}
                  />
                </div>
              </div>

              {executionError && <p className="text-xs text-red-600 font-semibold">{executionError}</p>}
              {executionResult && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded text-xs space-y-1 font-mono">
                  <p className="font-bold">Execution Successful ({executionResult.mode})</p>
                  <p>Operation ID: {executionResult.operationId}</p>
                  <p>Items Examined: {executionResult.itemsExamined} | Completed: {executionResult.itemsCompleted}</p>
                  <p>{executionResult.safeSummary}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" variant="primary" size="sm" onClick={handleExecute} disabled={executing}>
                  {executing ? "Executing..." : `Run ${executionMode}`}
                </Button>
              </div>
            </div>

            {/* Run History */}
            {runHistory && (
              <div>
                <h4 className="font-bold text-xs uppercase text-[--kt-text-muted] mb-2">Recent Run History</h4>
                <div className="kt-processor-dialog__history space-y-2">
                  {runHistory.length === 0 ? (
                    <p className="text-[--kt-text-muted]">No previous run evidence recorded.</p>
                  ) : (
                    runHistory.map((r, i) => (
                      <div key={i} className="border-b border-[--kt-border] pb-1 last:border-0 font-mono">
                        <span className="font-bold">{r.status}</span> — {r.safeSummary || "No summary"}
                        <span className="block text-[10px] text-[--kt-text-muted]">
                          Started: {new Date(r.startedAt).toLocaleString()} | Completed: {r.completedAt ? new Date(r.completedAt).toLocaleString() : "Running/Active"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </ProtectedDialog>
      )}
    </div>
  );
}
