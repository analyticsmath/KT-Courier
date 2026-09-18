"use client";

import { useState } from "react";
import Link from "next/link";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./quote-estimator.module.css";

interface ServiceTierConfig {
  id: string;
  name: string;
  baseFee: number;
  perKmRate: number;
  includedDistanceKm: number;
  includedWeightKg: number;
  perAdditionalKgRate: number;
  summary: string;
}

const SERVICE_TIERS: ServiceTierConfig[] = [
  {
    id: "STANDARD_COURIER",
    name: "Standard Same-Day",
    baseFee: 45.0,
    perKmRate: 7.5,
    includedDistanceKm: 5,
    includedWeightKg: 5,
    perAdditionalKgRate: 4.5,
    summary: "Base R45 · R7.50/km after 5km",
  },
  {
    id: "SCHEDULED_DELIVERY",
    name: "Scheduled Window",
    baseFee: 38.0,
    perKmRate: 6.0,
    includedDistanceKm: 5,
    includedWeightKg: 5,
    perAdditionalKgRate: 4.0,
    summary: "Base R38 · R6.00/km after 5km",
  },
  {
    id: "EXPRESS_SAME_DAY",
    name: "Express On-Demand",
    baseFee: 65.0,
    perKmRate: 9.5,
    includedDistanceKm: 5,
    includedWeightKg: 5,
    perAdditionalKgRate: 5.5,
    summary: "Base R65 · R9.50/km after 5km",
  },
  {
    id: "HEAVY_PARCEL",
    name: "Heavy Parcel / Freight",
    baseFee: 85.0,
    perKmRate: 12.0,
    includedDistanceKm: 5,
    includedWeightKg: 10,
    perAdditionalKgRate: 6.0,
    summary: "Base R85 · R12.00/km after 5km",
  },
];

interface PresetCorridor {
  name: string;
  distanceKm: number;
}

const PRESET_CORRIDORS: PresetCorridor[] = [
  { name: "JHB CBD ↔ Sandton", distanceKm: 14 },
  { name: "Rosebank ↔ Midrand", distanceKm: 24 },
  { name: "Sandton ↔ Pretoria", distanceKm: 48 },
  { name: "Soweto ↔ JHB CBD", distanceKm: 26 },
  { name: "East Rand ↔ Rosebank", distanceKm: 34 },
  { name: "Centurion ↔ Midrand", distanceKm: 18 },
];

function formatZar(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function PublicQuoteEstimator() {
  const [selectedTierId, setSelectedTierId] = useState("STANDARD_COURIER");
  const [distanceKm, setDistanceKm] = useState(14);
  const [weightKg, setWeightKg] = useState(3);
  const [activeCorridor, setActiveCorridor] = useState<string | null>("JHB CBD ↔ Sandton");

  const tier = SERVICE_TIERS.find((t) => t.id === selectedTierId) ?? SERVICE_TIERS[0];

  // Mathematical pricing invariant according to calculator.ts
  const billableDistanceKm = Math.max(0, distanceKm - tier.includedDistanceKm);
  const distanceFee = billableDistanceKm * tier.perKmRate;

  const excessWeightKg = Math.max(0, weightKg - tier.includedWeightKg);
  const weightFee = excessWeightKg * tier.perAdditionalKgRate;

  const subtotal = tier.baseFee + distanceFee + weightFee;
  const vatRate = 0.15; // 15% South African Statutory VAT
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;

  const handleCorridorSelect = (corridor: PresetCorridor) => {
    setActiveCorridor(corridor.name);
    setDistanceKm(corridor.distanceKm);
  };

  const handleCustomDistanceChange = (km: number) => {
    setActiveCorridor(null);
    setDistanceKm(km);
  };

  return (
    <div className={styles.estimatorRoot}>
      <div className={styles.estimatorHeader}>
        <h3 className={styles.estimatorHeaderTitle}>
          Instant Delivery Quote Estimator
        </h3>
        <span className={styles.estimatorBadge}>
          Live Commercial Rules · ZAR
        </span>
      </div>

      <div className={styles.estimatorLayout}>
        {/* Interactive Controls */}
        <div className={styles.estimatorControls}>
          {/* Service Tier Selector */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>1. Select Service Tier</span>
            <div className={styles.tierGrid}>
              {SERVICE_TIERS.map((t) => {
                const isActive = t.id === selectedTierId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.tierButton} ${isActive ? styles.tierButtonActive : ""}`}
                    onClick={() => setSelectedTierId(t.id)}
                  >
                    <span className={styles.tierName}>{t.name}</span>
                    <span className={styles.tierRateSummary}>{t.summary}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Corridor Selector */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>2. Key Gauteng Corridors (or custom)</span>
            <div className={styles.presetCorridors}>
              {PRESET_CORRIDORS.map((c) => {
                const isSelected = activeCorridor === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    className={`${styles.corridorChip} ${isSelected ? styles.corridorChipActive : ""}`}
                    onClick={() => handleCorridorSelect(c)}
                  >
                    {c.name} ({c.distanceKm} km)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance Slider */}
          <div className={styles.controlGroup}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className={styles.controlLabel}>Transit Distance</span>
              <span className={styles.sliderValue}>{distanceKm} km</span>
            </div>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={distanceKm}
                onChange={(e) => handleCustomDistanceChange(Number(e.target.value))}
                className={styles.rangeInput}
                aria-label="Transit distance in kilometers"
              />
            </div>
          </div>

          {/* Weight Slider */}
          <div className={styles.controlGroup}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className={styles.controlLabel}>Package Weight</span>
              <span className={styles.sliderValue}>{weightKg} kg</span>
            </div>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className={styles.rangeInput}
                aria-label="Package weight in kilograms"
              />
            </div>
          </div>
        </div>

        {/* Real-Time Breakdown Panel */}
        <div className={styles.estimatorSummary}>
          <div>
            <h4 className={styles.summaryTitle}>Estimated Price Breakdown</h4>

            <div className={styles.lineItemsList}>
              <div className={styles.lineItem}>
                <span className={styles.lineItemLabel}>
                  Base delivery fee ({tier.includedDistanceKm} km included)
                </span>
                <span className={styles.lineItemValue}>{formatZar(tier.baseFee)}</span>
              </div>

              <div className={styles.lineItem}>
                <span className={styles.lineItemLabel}>
                  Distance charge ({billableDistanceKm} billable km @ {formatZar(tier.perKmRate)}/km)
                </span>
                <span className={styles.lineItemValue}>{formatZar(distanceFee)}</span>
              </div>

              {weightFee > 0 ? (
                <div className={styles.lineItem}>
                  <span className={styles.lineItemLabel}>
                    Excess weight ({excessWeightKg} kg over {tier.includedWeightKg} kg)
                  </span>
                  <span className={styles.lineItemValue}>{formatZar(weightFee)}</span>
                </div>
              ) : (
                <div className={styles.lineItem}>
                  <span className={styles.lineItemLabel}>
                    Weight allowance (up to {tier.includedWeightKg} kg)
                  </span>
                  <span className={styles.lineItemValue}>Included</span>
                </div>
              )}

              <div className={styles.lineItem} style={{ paddingTop: 8, borderTop: "1px dashed var(--kt-cool-200, #dde1e0)" }}>
                <span className={styles.lineItemLabel}>Subtotal</span>
                <span className={styles.lineItemValue}>{formatZar(subtotal)}</span>
              </div>

              <div className={styles.lineItem}>
                <span className={styles.lineItemLabel}>VAT (15%)</span>
                <span className={styles.lineItemValue}>{formatZar(vatAmount)}</span>
              </div>
            </div>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total Estimate</span>
              <div style={{ textAlign: "right" }}>
                <span className={styles.totalValue}>{formatZar(total)}</span>
                <div className={styles.vatNotice}>Includes 15% statutory VAT</div>
              </div>
            </div>
          </div>

          <div>
            <Link
              href="/login?redirect=/account/request-delivery"
              className={styles.estimatorCta}
            >
              <span>Sign in to Book with this Estimate</span>
              <KtIconArrowRight size={16} />
            </Link>
            <p className={styles.nonBindingDisclaimer}>
              * Non-binding tariff estimate based on published standard rates. Final binding quote is calculated via route coordinate validation upon booking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
