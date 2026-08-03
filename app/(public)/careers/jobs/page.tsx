"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CareersJobsPage() {
  const [openings, setOpenings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchOpenings();
  }, [track, search]);

  const fetchOpenings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (track) params.set("track", track);
      if (search) params.set("search", search);
      const res = await fetch(`/api/careers/openings?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setOpenings(json.data || []);
      }
    } catch {
      // safe error state handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">KT Couriers Open Positions</h1>
      <p className="text-gray-600 mb-6">Explore first-party opportunities across internal operations and driver network.</p>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Search positions..."
          className="border rounded px-4 py-2 flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-4 py-2"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
        >
          <option value="">All Tracks</option>
          <option value="INTERNAL_EMPLOYEE">Internal Employee</option>
          <option value="DRIVER_NETWORK">Driver Network</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading open positions...</div>
      ) : openings.length === 0 ? (
        <div className="py-12 text-center text-gray-500 border rounded">No positions available currently matching criteria.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {openings.map((op) => (
            <div key={op.openingReference} className="border rounded p-6 shadow-sm hover:shadow transition">
              <h2 className="text-xl font-semibold mb-2">{op.title}</h2>
              <p className="text-sm text-gray-500 mb-3">{op.track} • {op.primaryLocation || "Flexible"}</p>
              <p className="text-gray-700 line-clamp-3 mb-4">{op.summary}</p>
              <Link
                href={`/careers/jobs/${op.openingReference}`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
              >
                View Opening & Apply
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
