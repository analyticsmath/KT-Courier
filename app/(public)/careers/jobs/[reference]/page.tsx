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

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-16 text-center font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)]">Loading opening details...</div>;
  if (error || !opening) return <div className="max-w-4xl mx-auto px-6 py-16 text-center font-mono text-xs uppercase tracking-widest text-[var(--kt-signal-red)]">{error || "Opening not found"}</div>;

  return (
    <article className="min-h-screen bg-[var(--kt-freight-paper)] text-[var(--kt-asphalt)] py-12 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/careers"
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
          >
            ← All positions
          </Link>
        </div>

        <div className="border-b border-[var(--kt-concrete)]/60 pb-8 mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3 text-[var(--kt-asphalt)]">{opening.title}</h1>
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--kt-road-grey)]">{opening.track} • {opening.primaryLocation || "Flexible Location"}</p>
          {opening.noFeeStatement && (
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--kt-signal-red)] mt-3">{opening.noFeeStatement}</p>
          )}
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] mb-3">Summary</h2>
            <p className="text-base text-[var(--kt-graphite)] leading-relaxed">{opening.summary}</p>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] mb-3">Responsibilities</h2>
            <p className="text-sm text-[var(--kt-graphite)] whitespace-pre-line leading-relaxed">{opening.responsibilities}</p>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] mb-3">Essential Criteria</h2>
            <p className="text-sm text-[var(--kt-graphite)] whitespace-pre-line leading-relaxed">{opening.essentialCriteria}</p>
          </section>

          {opening.desirableCriteria && (
            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] mb-3">Desirable Criteria</h2>
              <p className="text-sm text-[var(--kt-graphite)] whitespace-pre-line leading-relaxed">{opening.desirableCriteria}</p>
            </section>
          )}

          <div className="pt-8 border-t border-[var(--kt-concrete)]/60 flex flex-col sm:flex-row gap-6 justify-between items-center">
            <p className="text-xs text-[var(--kt-road-grey)] max-w-md">{opening.accessibilityStatement}</p>
            <Link
              href={`/applicant/applications/new/${opening.openingReference}`}
              className="kt-action-filled"
            >
              Apply for position &rarr;
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
