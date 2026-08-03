"use client";

import { useState, useEffect } from "react";

export default function AdminReportDefinitionsPage() {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/definitions");
        if (res.ok) {
          const data = await res.json();
          setDefinitions(data.data || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading definitions...</div>;

  return (
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
              <th className="p-3">Sensitivity</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {definitions.map((def) => (
              <tr key={def.key} className="hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{def.key}</td>
                <td className="p-3 font-medium">{def.name}</td>
                <td className="p-3">{def.audience}</td>
                <td className="p-3 font-mono text-xs text-gray-600">{def.requiredPermission}</td>
                <td className="p-3">{def.maximumRowCount}</td>
                <td className="p-3 font-semibold">{def.sensitivity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
