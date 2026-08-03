import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("subscription-source-audit / subscription-customer-ui-contract / subscription-store-ui-contract / subscription-admin-ui-contract", () => {
  it("keeps a single payment aggregate, source lock and required routes", () => {
    expect(read("prisma/schema.prisma")).toContain("SUBSCRIPTION_INVOICE");
    expect(read("lib/subscriptions/production-lock.ts")).toContain("CONSOLIDATED_VALIDATION_NOT_APPROVED");
    expect(read("lib/subscriptions/subscription-payment-success-hook.service.ts")).toContain("onVerifiedSubscriptionPaymentSucceeded");
    expect(read("app/(public)/membership/page.tsx")).toContain("membership");
    expect(read("app/(store)/store/subscription/page.tsx")).not.toContain("providerToken");
    expect(read("app/(admin)/admin/subscriptions/contracts/page.tsx")).toContain("ProgrammeAdministrationLockedPage");
  });
});
