/**
 * KT Couriers — Historical Simulation Timeline & Date Generators
 */

import { SeededRNG } from "./rng";

// 365-day historical simulation window ending in August 2026
export const SIMULATION_END = new Date("2026-08-28T12:00:00.000Z");
export const SIMULATION_START = new Date("2025-08-25T00:00:00.000Z");
export const FOUNDATION_DATE = new Date("2025-08-15T00:00:00.000Z");

export function randomDateBetween(start: Date, end: Date, rng: SeededRNG): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (endMs <= startMs) return new Date(startMs);
  return new Date(startMs + rng.next() * (endMs - startMs));
}

/**
 * Generate plausible transaction timestamps with time-of-day & day-of-week patterns:
 * - Food: lunch peak (11:30-14:00) & dinner peak (17:30-21:00), Fri/Sat uplift
 * - Grocery: weekend mornings (09:00-13:00) and month-end payday uplift (25th-2nd)
 * - Logistics: weekday business hours (08:30-16:30)
 * - E-Commerce: evening and weekend browse
 */
export function generateTemporalOrderDate(params: {
  customerCreatedAt: Date;
  storeCreatedAt: Date;
  vertical: "FOOD" | "GROCERIES" | "PHARMACY" | "ECOMMERCE" | "PARCEL";
  simulationEnd?: Date;
  rng: SeededRNG;
}): Date {
  const { customerCreatedAt, storeCreatedAt, vertical, simulationEnd = SIMULATION_END, rng } = params;
  const earlistPossible = new Date(Math.max(customerCreatedAt.getTime(), storeCreatedAt.getTime()) + 2 * 60 * 60 * 1000);
  
  if (earlistPossible >= simulationEnd) {
    return new Date(simulationEnd.getTime() - 10 * 60 * 1000);
  }

  // Pick base day within range
  const rawDate = randomDateBetween(earlistPossible, simulationEnd, rng);
  const day = rawDate.getUTCDate();
  let hour = 12;
  let minute = rng.int(0, 59);

  if (vertical === "FOOD") {
    // 40% lunch, 45% dinner, 15% other
    const r = rng.next();
    if (r < 0.40) {
      hour = rng.int(11, 13);
    } else if (r < 0.85) {
      hour = rng.int(17, 20);
    } else {
      hour = rng.int(8, 21);
    }
  } else if (vertical === "GROCERIES") {
    // Mornings and afternoons
    hour = rng.int(9, 17);
  } else if (vertical === "PARCEL") {
    // Business hours
    hour = rng.int(8, 16);
  } else {
    // E-Commerce / Pharmacy
    hour = rng.int(8, 20);
  }

  const result = new Date(rawDate);
  result.setUTCHours(hour, minute, rng.int(0, 59), rng.int(0, 999));

  // Ensure result is strictly after earliest possible and before simulation end
  if (result <= earlistPossible) {
    return new Date(earlistPossible.getTime() + rng.int(10, 180) * 60 * 1000);
  }
  if (result >= simulationEnd) {
    return new Date(simulationEnd.getTime() - rng.int(5, 60) * 60 * 1000);
  }

  return result;
}
