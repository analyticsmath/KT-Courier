import type { DeliveryConfiguration } from "./contracts";
const tariffs = (values: string[], perKm = "0.00") => ({
  SMALL: {
    baseFee: values[0],
    perKmRate: perKm,
    maximumWeightKg: null,
    minimumCharge: null,
  },
  MEDIUM: {
    baseFee: values[1],
    perKmRate: perKm,
    maximumWeightKg: null,
    minimumCharge: null,
  },
  LARGE: {
    baseFee: values[2],
    perKmRate: perKm,
    maximumWeightKg: null,
    minimumCharge: null,
  },
});
/** One-time client-supplied defaults. All subsequent changes use versioned database configuration. */
export const INITIAL_DELIVERY: DeliveryConfiguration[] = [
  {
    stableKey: "CLIENT_ECONOMY",
    displayName: "Economy",
    active: true,
    turnaround: "3–4 business days",
    provinces: ["Gauteng"],
    regionIds: [],
    tariffs: tariffs(["89.00", "129.00", "179.00"]),
    expectedVersion: 0,
    reason: "Initial client-approved Economy tariff",
  },
  {
    stableKey: "CLIENT_STANDARD",
    displayName: "Standard",
    active: true,
    turnaround: "1–2 business days",
    provinces: ["Gauteng"],
    regionIds: [],
    tariffs: tariffs(["129.00", "179.00", "249.00"]),
    expectedVersion: 0,
    reason: "Initial client tariff; final explicit Standard turnaround",
  },
  {
    stableKey: "CLIENT_EXPRESS",
    displayName: "Express",
    active: false,
    turnaround: "Same day, subject to operational capacity",
    provinces: ["Gauteng"],
    regionIds: [],
    tariffs: tariffs(["0.00", "0.00", "0.00"], "5.50"),
    expectedVersion: 0,
    reason: "Draft only: awaiting confirmation of Express fee interpretation",
  },
];
