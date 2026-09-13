import fs from "fs";
import path from "path";
import { DEMO_CUSTOMERS } from "../fixtures/customers";
import { DEMO_DRIVERS } from "../fixtures/drivers";
import { DEMO_PROMOTERS } from "../fixtures/promoters";

const customersPath = path.join(process.cwd(), "scripts", "demo", "fixtures", "customers.ts");
const driversPath = path.join(process.cwd(), "scripts", "demo", "fixtures", "drivers.ts");
const promotersPath = path.join(process.cwd(), "scripts", "demo", "fixtures", "promoters.ts");

// 1. Curate Customers: exactly 60
const curatedCustomers = DEMO_CUSTOMERS.slice(0, 60).map((c) => ({
  ...c,
  email: c.email.replace(/\s+/g, "."),
}));

const customersTs = `export interface CustomerIdentity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: {
    line1: string;
    suburb: string;
    city: string;
    province: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
}

export const DEMO_CUSTOMERS: CustomerIdentity[] = ${JSON.stringify(curatedCustomers, null, 2)};
`;

fs.writeFileSync(customersPath, customersTs, "utf8");
console.log(`✓ Curated ${curatedCustomers.length} Customers in ${customersPath}`);

// 2. Curate Drivers: exactly 24 (18 ACTIVE, 4 PENDING, 2 SUSPENDED)
const curatedDrivers = DEMO_DRIVERS.slice(0, 24).map((d, idx) => {
  let status: "ACTIVE" | "PENDING" | "SUSPENDED" = "ACTIVE";
  if (idx >= 22) {
    status = "SUSPENDED";
  } else if (idx >= 18) {
    status = "PENDING";
  }
  return {
    ...d,
    status,
    email: d.email.replace(/\s+/g, "."),
  };
});

const driversTs = `export interface DriverIdentity {
  id: string;
  email: string;
  name: string;
  phone: string;
  idNumber: string;
  vehicleType: "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";
  vehicleModel: string;
  vehiclePlate: string;
  city: string;
  province: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  avatarRef: string;
}

export const DEMO_DRIVERS: DriverIdentity[] = ${JSON.stringify(curatedDrivers, null, 2)};
`;

fs.writeFileSync(driversPath, driversTs, "utf8");
console.log(`✓ Curated ${curatedDrivers.length} Drivers in ${driversPath} (18 Active, 4 Pending, 2 Suspended)`);

// 3. Curate Promoters: exactly 10
const curatedPromoters = DEMO_PROMOTERS.slice(0, 10).map((p) => ({
  ...p,
  email: p.email.replace(/\s+/g, "."),
}));

const promotersTs = `export interface PromoterIdentity {
  id: string;
  email: string;
  name: string;
  phone: string;
  referralCode: string;
  channel: string;
  status: "ACTIVE" | "PENDING";
}

export const DEMO_PROMOTERS: PromoterIdentity[] = ${JSON.stringify(curatedPromoters, null, 2)};
`;

fs.writeFileSync(promotersPath, promotersTs, "utf8");
console.log(`✓ Curated ${curatedPromoters.length} Promoters in ${promotersPath}`);
