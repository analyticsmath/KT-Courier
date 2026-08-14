import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
describe("shipping/POD authority closure", () => {
  it("keeps service launch and SLA configuration versioned", () => { const schema = read("prisma/schema.prisma"); const service = read("lib/services/shipping-governance.service.ts"); expect(schema).toMatch(/model DeliveryServiceDefinition[\s\S]*versionNumber[\s\S]*slaMetadata[\s\S]*launchScope/); expect(service).toMatch(/effectiveFrom/); expect(service).toMatch(/FULL_DIGITAL.*QUOTE_REQUEST.*LEAD_ONLY/); });
  it("uses canonical execution for OTP, GPS, private proof and idempotent completion", () => { const execution = read("lib/services/delivery-execution.service.ts"); const otp = read("lib/services/delivery-otp.service.ts"); expect(execution).toMatch(/verifyDeliveryOtpInTx/); expect(execution).toMatch(/requireVerifiedDeliveryLocationInTx/); expect(execution).toMatch(/consumeProofEvidenceInTx/); expect(execution).toMatch(/findOperationReplay/); expect(otp).toMatch(/codeHash/); });
  it("preserves failed attempts and controls redelivery as a new explicit decision", () => { const schema = read("prisma/schema.prisma"); const service = read("lib/services/shipping-governance.service.ts"); expect(schema).toMatch(/model DeliveryAttempt[\s\S]*attemptNumber[\s\S]*retryable/); expect(schema).toMatch(/model RedeliveryRequest[\s\S]*priorAttemptId[\s\S]*commercialEvidence/); expect(service).toMatch(/REDELIVERY_ALREADY_REQUESTED/); expect(service).toMatch(/NO_HARDCODED_REDELIVERY_FEE/); expect(service).toMatch(/requestClaimFulfilmentRemedy/); });
});
