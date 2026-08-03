"use client";

import { useState, useEffect } from "react";

export default function AdminReportReconciliationPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [scanning, setScanning] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/reports/reconciliation");
      if (res.ok) {
        const data = await res.json();
        setCases(data.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleScan = async (dryRun: boolean) => {
    setScanning(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/admin/reports/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SCAN", dryRun }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionMessage(
          `Scan completed. Cases opened: ${data.data.casesOpened}, Cases resolved: ${data.data.casesResolved}`
        );
        load();
      }
    } catch {
      setActionMessage("Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading reconciliation...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporting Reconciliation & Invariants</h1>
          <p className="text-sm text-gray-500">Detect and resolve stuck jobs and missing artifacts.</p>
        </div>

        <div className="space-x-3">
          <button
            onClick={() => handleScan(true)}
            disabled={scanning}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 py-2 px-4 rounded text-sm font-medium"
          >
            Dry-Run Scan
          </button>
          <button
            onClick={() => handleScan(false)}
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm font-medium"
          >
            Apply Reconciliation Scan
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 bg-blue-50 text-blue-800 rounded border border-blue-200 text-sm font-medium">
          {actionMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b text-gray-700">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Status</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Opened At</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{c.publicReference}</td>
                <td className="p-3 font-mono text-xs text-red-600">{c.reason}</td>
                <td className="p-3 font-semibold">{c.status}</td>
                <td className="p-3 text-xs">{c.safeSummary}</td>
                <td className="p-3">{new Date(c.openedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
