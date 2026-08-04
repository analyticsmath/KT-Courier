"use client";

import { useState, useEffect } from "react";
import { ProtectedPageFrame, ProtectedState } from "@/components/protected-v2";
import { reportArtifactSummarySchema, type ReportArtifactSummary } from "@/lib/reporting/client-contracts";
import { z } from "zod";

const reportArtifactsResponseSchema = z.object({ data: z.array(reportArtifactSummarySchema) });

export default function AdminReportArtifactsPage() {
  const [artifacts, setArtifacts] = useState<ReportArtifactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/artifacts");
        if (res.ok) {
          const parsed = reportArtifactsResponseSchema.safeParse(await res.json());
          if (parsed.success) setArtifacts(parsed.data.data);
          else setError("Report artifacts are temporarily unavailable.");
        } else {
          setError("Report artifacts are temporarily unavailable.");
        }
      } catch {
        setError("Report artifacts are temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading artifacts...</div>;
  if (error) return <ProtectedPageFrame><ProtectedState kind="unavailable" title="Report artifacts unavailable" description={error} /></ProtectedPageFrame>;

  return (
    <ProtectedPageFrame>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Export Artifacts Audit</h1>
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b text-gray-700">
              <tr>
                <th className="p-3">Artifact Reference</th>
                <th className="p-3">Format</th>
                <th className="p-3">Bytes</th>
                <th className="p-3">Checksum (SHA-256)</th>
                <th className="p-3">Downloads</th>
                <th className="p-3">Expires At</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {artifacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No generated report artifacts found.
                  </td>
                </tr>
              ) : (
                artifacts.map((art) => (
                  <tr key={art.id}>
                    <td className="p-3 font-mono font-medium">{art.publicReference}</td>
                    <td className="p-3">{art.format}</td>
                    <td className="p-3">{art.byteSize}</td>
                    <td className="p-3 font-mono text-xs text-gray-600">{art.checksum}</td>
                    <td className="p-3">{art.downloadCount}</td>
                    <td className="p-3">{new Date(art.expiresAt).toLocaleString()}</td>
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
