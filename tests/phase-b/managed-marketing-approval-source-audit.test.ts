import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing approval authority", () => {
  it("uses the existing request workflow and immutable event history without a new persistence model", () => {
    const schema = read("prisma/schema.prisma");
    const service = read("lib/advertising/managed-marketing.service.ts");
    expect(schema).toMatch(/enum ManagedMarketingRequestStatus[\s\S]*UNDER_REVIEW[\s\S]*APPROVED[\s\S]*REJECTED/);
    expect(schema).toMatch(/model ManagedMarketingRequestEvent/);
    expect(service).toMatch(/applyReviewTransition/);
    expect(service).toMatch(/REVIEW_STARTED/);
    expect(service).toMatch(/APPROVED/);
    expect(service).toMatch(/REJECTED/);
    expect(service).toMatch(/requireApprovedForExecution/);
  });

  it("requires distinct review, approval and rejection capabilities, validates approval prerequisites, and records auditable idempotent transitions", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    const permissions = read("lib/auth/permission-keys.ts");
    expect(service).toMatch(/requireReviewPermission/);
    expect(service).toMatch(/validateCommittedRequest/);
    expect(service).toMatch(/MANAGED_MARKETING_IDEMPOTENCY_CONFLICT/);
    expect(service).toMatch(/managedMarketingRequestEvent\.findUnique/);
    expect(service).toMatch(/AdminActionType\.STATUS_CHANGE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_REVIEW/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_APPROVE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_REJECT/);
  });

  it("keeps workflow routes thin and exact-permission guarded", () => {
    const review = read("app/api/admin/managed-marketing/requests/[reference]/review/route.ts");
    const approve = read("app/api/admin/managed-marketing/requests/[reference]/approve/route.ts");
    const reject = read("app/api/admin/managed-marketing/requests/[reference]/reject/route.ts");
    expect(review).toMatch(/MANAGED_MARKETING_REQUESTS_REVIEW/);
    expect(approve).toMatch(/MANAGED_MARKETING_REQUESTS_APPROVE/);
    expect(reject).toMatch(/MANAGED_MARKETING_REQUESTS_REJECT/);
    expect(approve).toMatch(/managedMarketingService\.approveRequest/);
  });
});
