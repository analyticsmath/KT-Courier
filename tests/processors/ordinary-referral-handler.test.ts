import { expect, it, vi } from "vitest";

vi.mock("@/lib/rewards/ordinary-referral-award.service", () => ({
  processAutomaticOrdinaryReferralAwards: vi.fn().mockResolvedValue({
    itemsExamined: 3, itemsAwarded: 1, itemsSkipped: 1, itemsFailed: 1, safeSummary: "One retry required.",
  }),
}));

import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";

it("reports failed referral awards for operator retry instead of hiding them", async () => {
  const outcome = await PROCESSOR_HANDLERS["process-ordinary-referral-awards"]({
    mode: "APPLY", batchSize: 3, operationId: "test-operation", actorUserId: "operator",
  });
  expect(outcome).toMatchObject({ itemsExamined: 3, itemsCompleted: 1, itemsSkipped: 1, itemsRetried: 1 });
});
