import process from "node:process";

const password = process.env.KT_DEMO_ACCOUNT_PASSWORD || "KT-Demo-2026!";

const featuredAccounts = [
  { role: "SUPER_ADMIN", email: "superadmin@demo.ktcouriers.test", name: "KT Super Admin", dashboard: "/admin/dashboard", scenario: "Super Administrator with global platform permissions." },
  { role: "ADMIN (Ops)", email: "ops.admin.01@demo.ktcouriers.test", name: "Kagiso Molefe", dashboard: "/admin/operations", scenario: "Operations Admin managing real-time dispatch and driver tracking." },
  { role: "ADMIN (Finance)", email: "finance.admin.01@demo.ktcouriers.test", name: "Sipho Dlamini", dashboard: "/admin/finance", scenario: "Finance Admin with ledger, withdrawal approval, and settlement rights." },
  { role: "ADMIN (Recruitment)", email: "recruiter.01@demo.ktcouriers.test", name: "Nomvula Bhengu", dashboard: "/admin/recruitment", scenario: "Talent acquisition lead managing driver & staff application pipeline." },
  { role: "ADMIN (Support)", email: "support.agent.01@demo.ktcouriers.test", name: "Tebogo Mabena", dashboard: "/admin/support", scenario: "Support agent handling ticket escalations and customer inquiries." },
  { role: "CUSTOMER", email: "customer.01@demo.ktcouriers.test", name: "Lerato Mokoena", dashboard: "/customer/dashboard", scenario: "Active customer with delivered courier & marketplace order history." },
  { role: "CUSTOMER", email: "customer.02@demo.ktcouriers.test", name: "Johan Pretorius", dashboard: "/customer/dashboard", scenario: "High-frequency business customer with wallet credits and active subscriptions." },
  { role: "STORE OWNER", email: "store.owner.01@demo.ktcouriers.test", name: "Fresh Basket Grocers Owner", dashboard: "/store/dashboard", scenario: "Store owner with high marketplace order volume, catalog, and earnings." },
  { role: "STORE OWNER", email: "store.owner.04@demo.ktcouriers.test", name: "TechHub South Africa Owner", dashboard: "/store/dashboard", scenario: "Electronics store merchant with pending withdrawal requests." },
  { role: "DRIVER", email: "driver.001@demo.ktcouriers.test", name: "Driver Sipho (DRV-1001)", dashboard: "/driver/dashboard", scenario: "Showcase active driver with active delivery in transit and earnings." },
  { role: "DRIVER", email: "driver.002@demo.ktcouriers.test", name: "Driver Jabu (DRV-1002)", dashboard: "/driver/dashboard", scenario: "Available driver with complete earnings history and verified documents." },
  { role: "PROMOTER", email: "promoter.001@demo.ktcouriers.test", name: "Promoter 001", dashboard: "/promoter/dashboard", scenario: "Active promoter with attributed customer referrals and released earnings." },
  { role: "PROMOTER", email: "promoter.002@demo.ktcouriers.test", name: "Promoter 002", dashboard: "/promoter/dashboard", scenario: "Promoter with held earnings and withdrawal history." },
  { role: "APPLICANT", email: "applicant.001@demo.ktcouriers.test", name: "Applicant 001", dashboard: "/careers/dashboard", scenario: "Applicant with scheduled interview for Courier Driver vacancy." },
  { role: "APPLICANT", email: "applicant.005@demo.ktcouriers.test", name: "Applicant 005", dashboard: "/careers/dashboard", scenario: "Applicant with active issued employment offer." },
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
