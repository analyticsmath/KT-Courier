"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

type PublicOpening = {
  title?: string; track?: string; primaryLocation?: string; noFeeStatement?: string;
  summary?: string; responsibilities?: string; essentialCriteria?: string; desirableCriteria?: string; accessibilityStatement?: string; openingReference?: string;
};

export default function CareersJobDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = use(params);
  const [opening, setOpening] = useState<PublicOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/careers/openings/${reference}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setOpening(json.data);
        } else {
          setError("This role is unavailable.");
        }
      })
      .catch(() => setError("This role is unavailable."))
      .finally(() => setLoading(false));
  }, [reference]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">Loading opening details...</div>;
  if (error || !opening) return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-red-500">{error || "Opening not found"}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="border-b pb-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{opening.title}</h1>
        <p className="text-gray-500">{opening.track} • {opening.primaryLocation || "Flexible Location"}</p>
        <p className="text-xs text-blue-600 font-semibold mt-2">{opening.noFeeStatement}</p>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <p className="text-gray-700 leading-relaxed">{opening.summary}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Responsibilities</h2>
          <p className="text-gray-700 whitespace-pre-line">{opening.responsibilities}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Essential Criteria</h2>
          <p className="text-gray-700 whitespace-pre-line">{opening.essentialCriteria}</p>
        </section>

        {opening.desirableCriteria && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Desirable Criteria</h2>
            <p className="text-gray-700 whitespace-pre-line">{opening.desirableCriteria}</p>
          </section>
        )}

        <div className="pt-6 border-t flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-xs text-gray-500">{opening.accessibilityStatement}</p>
          <Link
            href={`/applicant/applications/new/${opening.openingReference}`}
            className="bg-blue-600 text-white px-6 py-3 rounded font-medium hover:bg-blue-700"
          >
            Apply Now
          </Link>
        </div>
      </div>
    </div>
  );
}
