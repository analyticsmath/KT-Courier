"use client";
import { useState } from "react";
import Link from "next/link";
import {
  PublicCoverageMap,
  type PublicDeliveryRegion,
} from "@/components/public-v2/maps";
import type { PublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import styles from "./coverage-explorer.module.css";
export function CoverageInteractiveView({
  snapshot,
}: {
  snapshot: PublicCoverageSnapshot;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const regions: readonly PublicDeliveryRegion[] = snapshot.regions;
  const selected = regions[selectedIdx] || regions[0];
  return (
    <div className={styles.explorer}>
      <div className={styles.map}>
        <PublicCoverageMap
          className={styles.mapCanvas}
          interactive
          onSelectIndex={setSelectedIdx}
          regions={regions}
          selectedIndex={selectedIdx}
          showBadge={false}
        />
      </div>
      <div className={styles.details}>
        <p className={styles.notice}>
          Route availability depends on the exact pickup and destination,
          selected service and current operational capacity. For a route that
          needs a closer look, talk to our team.
        </p>
        {selected && (
          <section
            className={styles.selected}
            aria-label="Selected delivery region"
          >
            <h3>{selected.name}</h3>
            <p>
              {[selected.city, selected.province].filter(Boolean).join(", ")}
            </p>
            {selected.description && <p>{selected.description}</p>}
            {selected.coverageMode === "PROVINCE" ? (
              <p>Configured coverage: {selected.province} province.</p>
            ) : selected.coverageRadiusKm ? (
              <p>
                Configured service radius: approximately{" "}
                {selected.coverageRadiusKm} km.
              </p>
            ) : null}
          </section>
        )}
        <h3 className={styles.listTitle}>
          {snapshot.state === "ACTIVE_REGIONS"
            ? "Choose a delivery region"
            : snapshot.state === "SOURCE_UNAVAILABLE"
              ? "Checking the latest coverage."
              : "Coverage list being updated"}
        </h3>
        {snapshot.state === "SOURCE_UNAVAILABLE" ? (
          <div className={styles.sourceNotice}>
            <p>
              Current delivery coverage cannot be verified automatically. Please
              contact our team to confirm pickup and destination availability
              before booking.
            </p>
            <Link href="/contact" className="kt-text-link">
              Contact operations team ↗
            </Link>
          </div>
        ) : snapshot.state === "EMPTY_CONFIGURATION" || !regions.length ? (
          <div className={styles.sourceNotice}>
            <p>
              We’re updating the public coverage list. Availability is confirmed
              from the pickup and drop-off details in your request.
            </p>
            <Link href="/contact" className="kt-text-link">
              Check availability with the team ↗
            </Link>
          </div>
        ) : (
          <ul className={styles.regions}>
            {regions.map((region, i) => (
              <li key={region.id || region.name}>
                <button
                  type="button"
                  aria-pressed={i === selectedIdx}
                  onClick={() => setSelectedIdx(i)}
                  onFocus={() => setSelectedIdx(i)}
                >
                  <span>
                    {region.name}
                    <small>
                      {[region.city, region.province]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <Link href="/quote" className="kt-pill">
            Check your delivery route ↗
          </Link>
          <Link href="/services/pricing" className="kt-text-link">
            What shapes a quote? ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
