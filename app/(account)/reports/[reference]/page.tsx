"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2";
import { reportJobDetailSchema, type ReportJobDetail } from "@/lib/reporting/client-contracts";
import { z } from "zod";

const reportJobResponseSchema = z.object({ data: reportJobDetailSchema });
const downloadResponseSchema = z.object({ data: z.object({ downloadUrl: z.string().startsWith("/api/reports/") }) });
const errorResponseSchema = z.object({ error: z.string() });

export default function ReportDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [job, setJob] = useState<ReportJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadJob() {
      try {
        const res = await fetch(`/api/reports/${reference}`);
        if (res.ok) {
          const parsed = reportJobResponseSchema.safeParse(await res.json());
          if (parsed.success) setJob(parsed.data.data);
          else setError("The report service returned an invalid response.");
        } else {
          setError("Failed to fetch report job details.");
        }
      } catch {
        setError("Network error fetching report details.");
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [reference]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/${reference}/download`, {
        method: "POST",
      });
      if (res.ok) {
        const parsed = downloadResponseSchema.safeParse(await res.json());
        if (parsed.success) window.location.assign(parsed.data.data.downloadUrl);
        else setError("The report service returned an invalid download response.");
      } else {
        const parsed = errorResponseSchema.safeParse(await res.json());
        setError(parsed.success ? parsed.data.error : "Failed to generate download link.");
      }
    } catch {
      setError("Download request failed.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading report details...</div>;
  }

  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center space-y-4">
        <div className="text-red-600 font-medium">{error || "Report not found"}</div>
        <Link href="/reports" className="text-blue-600 underline">
          Return to Reports
        </Link>
      </div>
    );
  }

  return (
    <ProtectedPageFrame>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Report Job {job.publicReference}</h1>
            <p className="text-sm text-gray-500">{job.definitionKey}</p>
          </div>
          <Link href="/reports" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Reports
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <span className="text-gray-500 block">Status</span>
              <span className="font-semibold text-gray-900">{job.status}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Format</span>
              <span className="font-semibold text-gray-900">{job.outputFormat}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Row Count</span>
              <span className="font-semibold text-gray-900">{job.rowCount ?? "Pending"}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Requested At</span>
              <span className="font-semibold text-gray-900">{new Date(job.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {job.artifact && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200 space-y-2">
              <h3 className="font-semibold text-gray-900">Export Artifact Ready</h3>
              <p className="text-xs text-gray-500">
                Checksum (SHA-256): <code className="font-mono">{job.artifact.checksum}</code>
              </p>
              <p className="text-xs text-gray-500">
                Expires At: {new Date(job.artifact.expiresAt).toLocaleString()}
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded transition"
              >
                {downloading ? "Preparing Download..." : "Download Export Artifact"}
              </button>
            </div>
          )}

          {job.errorMessage && (
            <div className="p-4 bg-red-50 text-red-800 rounded border border-red-200 text-xs font-mono">
              Error: {job.errorMessage}
            </div>
          )}
        </div>
      </div>
    </ProtectedPageFrame>
  );
}
