"use client";

import { useState, useEffect } from "react";
import { ProtectedPageFrame, ProtectedState } from "@/components/protected-v2";
import { reportDefinitionSummarySchema, type ReportDefinitionSummary } from "@/lib/reporting/client-contracts";
import { z } from "zod";

const reportDefinitionsResponseSchema = z.object({ data: z.array(reportDefinitionSummarySchema) });

export default function AdminReportDefinitionsPage() {
  const [definitions, setDefinitions] = useState<ReportDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/definitions");
        if (res.ok) {
          const parsed = reportDefinitionsResponseSchema.safeParse(await res.json());
          if (parsed.success) setDefinitions(parsed.data.data);
          else setError("Report definitions are temporarily unavailable.");
        } else {
          setError("Report definitions are temporarily unavailable.");
        }
      } catch {
        setError("Report definitions are temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading definitions...</div>;
  if (error) return <ProtectedPageFrame><ProtectedState kind="unavailable" title="Report definitions unavailable" description={error} /></ProtectedPageFrame>;

  return (
    <ProtectedPageFrame>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">System Report Definitions Catalog</h1>
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b text-gray-700">
              <tr>
                <th className="p-3">Key</th>
                <th className="p-3">Name</th>
                <th className="p-3">Audience</th>
                <th className="p-3">Required Permission</th>
                <th className="p-3">Max Rows</th>
                <th className="p-3">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {definitions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No report definitions registered.
                  </td>
                </tr>
              ) : (
                definitions.map((def) => (
                  <tr key={def.key}>
                    <td className="p-3 font-mono font-medium">{def.key}</td>
                    <td className="p-3">{def.name}</td>
                    <td className="p-3">{def.audience}</td>
                    <td className="p-3 font-mono text-xs">{def.requiredPermission}</td>
                    <td className="p-3">{def.maximumRowCount}</td>
                    <td className="p-3">v{def.version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedPageFrame>
  );
}
