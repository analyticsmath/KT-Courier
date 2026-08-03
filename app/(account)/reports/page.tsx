"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ReportDefinition {
  key: string;
  name: string;
  description: string;
  allowedFormats: string[];
}

interface ReportJob {
  id: string;
  publicReference: string;
  definitionKey: string;
  status: string;
  outputFormat: string;
  rowCount: number | null;
  createdAt: string;
}

export default function ReportsPage() {
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [format, setFormat] = useState("CSV");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [defRes, jobsRes] = await Promise.all([
          fetch("/api/reports/definitions"),
          fetch("/api/reports"),
        ]);

        if (defRes.ok) {
          const defData = await defRes.json();
          setDefinitions(defData.data || []);
          if (defData.data?.[0]) setSelectedKey(defData.data[0].key);
        }

        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData.data || []);
        }
      } catch {
        // silent load error
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey) return;

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionKey: selectedKey,
          outputFormat: format,
          executionMode: "ASYNCHRONOUS_EXPORT",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setMessage(`Report job requested successfully: ${result.data.publicReference}`);
        // refresh jobs
        const jobsRes = await fetch("/api/reports");
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setJobs(jobsData.data || []);
        }
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.message || "Failed to generate report"}`);
      }
    } catch {
      setMessage("Failed to request report generation.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading reporting center...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Secure Reports & Data Exports</h1>
        <p className="text-gray-600">
          Request, generate, and download privacy-safe self-service reports and data exports.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-md font-medium">
          {message}
        </div>
      )}

      {/* Generate Form */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Request New Export</h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Definition</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {definitions.map((def) => (
                <option key={def.key} value={def.key}>
                  {def.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="CSV">CSV Spreadsheet</option>
              <option value="JSON">JSON Data</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 transition"
            >
              {submitting ? "Requesting..." : "Generate Export"}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Jobs Table */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Report Job History</h2>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">No report jobs requested yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 border-b">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Report</th>
                  <th className="p-3">Format</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Rows</th>
                  <th className="p-3">Requested At</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium">{job.publicReference}</td>
                    <td className="p-3">{job.definitionKey}</td>
                    <td className="p-3">{job.outputFormat}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                          job.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : job.status === "FAILED_PERMANENT"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="p-3">{job.rowCount ?? "—"}</td>
                    <td className="p-3">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <Link
                        href={`/reports/${job.publicReference}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        View & Download
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
