"use client";

import { useState, useEffect } from "react";

export default function AdminReportArtifactsPage() {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/artifacts");
        if (res.ok) {
          const data = await res.json();
          setArtifacts(data.data || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading artifacts...</div>;

  return (
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
            {artifacts.map((art) => (
              <tr key={art.id} className="hover:bg-gray-50">
                <td className="p-3 font-mono font-medium">{art.publicReference}</td>
                <td className="p-3">{art.format}</td>
                <td className="p-3 font-mono text-xs">{art.byteSize} B</td>
                <td className="p-3 font-mono text-xs max-w-xs truncate">{art.checksum}</td>
                <td className="p-3">{art.downloadCount}</td>
                <td className="p-3">{new Date(art.expiresAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
