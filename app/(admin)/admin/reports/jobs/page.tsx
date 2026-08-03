"use client";

import { useState, useEffect } from "react";

export default function AdminReportJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/jobs");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.data || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading jobs...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">System Report Jobs</h1>
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b text-gray-700">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Definition Key</th>
              <th className="p-3">Requester Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Format</th>
              <th className="p-3">Rows</th>
              <th className="p-3">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y text-gray-800">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="p-3 font-mono font-medium">{job.publicReference}</td>
                <td className="p-3 font-mono text-xs">{job.definitionKey}</td>
                <td className="p-3">{job.requesterRole}</td>
                <td className="p-3 font-semibold">{job.status}</td>
                <td className="p-3">{job.outputFormat}</td>
                <td className="p-3">{job.rowCount ?? "—"}</td>
                <td className="p-3">{new Date(job.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
