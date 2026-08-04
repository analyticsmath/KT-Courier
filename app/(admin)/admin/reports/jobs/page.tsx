"use client";

import { useState, useEffect } from "react";
import { ProtectedPageFrame, ProtectedState } from "@/components/protected-v2";
import { reportJobSummarySchema, type ReportJobSummary } from "@/lib/reporting/client-contracts";
import { z } from "zod";

const reportJobsResponseSchema = z.object({ data: z.array(reportJobSummarySchema) });

export default function AdminReportJobsPage() {
  const [jobs, setJobs] = useState<ReportJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/reports/jobs");
        if (res.ok) {
          const parsed = reportJobsResponseSchema.safeParse(await res.json());
          if (parsed.success) setJobs(parsed.data.data);
          else setError("Report jobs are temporarily unavailable.");
        } else {
          setError("Report jobs are temporarily unavailable.");
        }
      } catch {
        setError("Report jobs are temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading jobs...</div>;
  if (error) return <ProtectedPageFrame><ProtectedState kind="unavailable" title="Report jobs unavailable" description={error} /></ProtectedPageFrame>;

  return (
    <ProtectedPageFrame>
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
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No report jobs found.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="p-3 font-mono font-medium">{job.publicReference}</td>
                    <td className="p-3">{job.definitionKey}</td>
                    <td className="p-3">{job.requesterRole}</td>
                    <td className="p-3">{job.status}</td>
                    <td className="p-3">{job.outputFormat}</td>
                    <td className="p-3">{job.rowCount ?? "—"}</td>
                    <td className="p-3">{new Date(job.createdAt).toLocaleString()}</td>
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
