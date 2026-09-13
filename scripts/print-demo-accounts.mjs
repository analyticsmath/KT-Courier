import process from "node:process";

const password = process.env.KT_DEMO_ACCOUNT_PASSWORD || "password123";

const featuredAccounts = [
  {
    role: "SUPER_ADMIN",
    email: "superadmin@ktcouriers.local",
    name: "System Super Admin",
    dashboard: "/admin/dashboard",
    scenario: "Super Administrator with global platform access, moderation, settings, and ledger visibility.",
  },
  {
    role: "ADMIN (Ops & Dispatch)",
    email: "admin@ktcouriers.local",
    name: "Operations Admin",
    dashboard: "/admin/operations",
    scenario: "Operations Administrator managing live fleet dispatches, assignment monitors, and hub tracking.",
  },
  {
    role: "STORE OWNER (Groceries)",
    email: "store.ubuntu-fresh-market@ktcouriers.local",
    name: "Sipho Ndlovu",
    dashboard: "/store/dashboard",
    scenario: "Active merchant in Johannesburg with published groceries, floral, and pet assortments.",
  },
  {
    role: "STORE OWNER (Electronics)",
    email: "store.circuit-house-electronics@ktcouriers.local",
    name: "Vikram Naidoo",
    dashboard: "/store/dashboard",
    scenario: "Pretoria electronics merchant with audio gear, chargers, and automotive tech catalog.",
  },
  {
    role: "STORE OWNER (Bakery)",
    email: "store.kloof-street-bakery@ktcouriers.local",
    name: "Pieter Van Wyk",
    dashboard: "/store/dashboard",
    scenario: "Cape Town artisanal bakery merchant with sourdough breads, croissants, and celebration cakes.",
  },
  {
    role: "DRIVER (Active Fleet - Car)",
    email: "driver.lerato.adams1@ktcouriers.local",
    name: "Lerato Adams (DRV-001)",
    dashboard: "/driver/dashboard",
    scenario: "Active verified driver in Johannesburg operating a Toyota Corolla Quest with active dispatch history.",
  },
  {
    role: "DRIVER (Active Fleet - Motorcycle)",
    email: "driver.kagiso.khumalo2@ktcouriers.local",
    name: "Kagiso Khumalo (DRV-002)",
    dashboard: "/driver/dashboard",
    scenario: "Active motorcycle driver operating a Honda Ace 125 for rapid urban express dispatches.",
  },
  {
    role: "CUSTOMER (Primary Showcase)",
    email: "sizwe.zulu1@example.co.za",
    name: "Sizwe Zulu",
    dashboard: "/customer/dashboard",
    scenario: "High-activity residential customer in Parkhurst with multi-store marketplace orders and courier tracking.",
  },
  {
    role: "CUSTOMER (Secondary Showcase)",
    email: "tanya.chetty2@example.co.za",
    name: "Tanya Chetty",
    dashboard: "/customer/dashboard",
    scenario: "Customer in Menlyn, Pretoria with pharmacy and grocery orders across Gauteng.",
  },
  {
    role: "PROMOTER (Community & Social)",
    email: "promoter.themba.du.plessis1@ktcouriers.local",
    name: "Themba Du Plessis",
    dashboard: "/promoter/dashboard",
    scenario: "Active affiliate promoter with referral code JHBVIBES and attributed orders.",
  },
];

console.log("\n==========================================================================");
console.log("            KT COURIERS FEATURED DEMO ACCOUNTS CATALOG                   ");
console.log("==========================================================================");
console.log(`Shared Local Account Password:  ${password}`);
console.log("--------------------------------------------------------------------------\n");

for (const acc of featuredAccounts) {
  console.log(`👤 Role:      ${acc.role}`);
  console.log(`   Email:     ${acc.email}`);
  console.log(`   Password:  ${password}`);
  console.log(`   Name:      ${acc.name}`);
  console.log(`   Dashboard: ${acc.dashboard}`);
  console.log(`   Scenario:  ${acc.scenario}\n`);
}

console.log("==========================================================================\n");
