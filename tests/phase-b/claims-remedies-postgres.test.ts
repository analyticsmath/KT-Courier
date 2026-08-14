import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { addClaimEvidence, ClaimDomainError, createClaim, decideClaimRemedy, getClaimForActor } from "@/lib/claims/claim.service";
import { ClaimReason, ClaimRemedyType, PrivateMediaOwnerType, PrivateMediaPurpose, UserRole, UserStatus } from "@/types/db";

const marker = randomUUID().replaceAll("-", "");
const claimOperationId = (suffix: string) => `CLMOP-${marker.toUpperCase()}-${suffix}`;
const remedyOperationId = (suffix: string) => `CLMR-${marker.toUpperCase()}-${suffix}`;
let customerId = "";
let unrelatedCustomerId = "";
let operatorId = "";
let orderReference = "";
let claimReference = "";

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  const customer = await prisma.user.create({ data: { email: `claim-${marker}-customer@example.test`, passwordHash: "phase-b-test-only", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, name: "Claim customer" } });
  const unrelated = await prisma.user.create({ data: { email: `claim-${marker}-unrelated@example.test`, passwordHash: "phase-b-test-only", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, name: "Unrelated customer" } });
  const operator = await prisma.user.create({ data: { email: `claim-${marker}-operator@example.test`, passwordHash: "phase-b-test-only", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, name: "Claim operator" } });
  customerId = customer.id;
  unrelatedCustomerId = unrelated.id;
  operatorId = operator.id;
  orderReference = `CLM-${marker.slice(0, 20)}`;
  await prisma.order.create({ data: { orderNumber: orderReference, source: "CUSTOMER", deliveryType: "SAME_DAY", currency: "ZAR", customerId, recipientName: "Claim recipient", recipientPhone: "+27110000000", parcelCount: 1, priceEstimate: "100.00", pricingSubtotal: "100.00", pricingTaxAmount: "0.00", pricingTaxRate: "0.0000", pricingSnapshot: { suite: "phase-b-claims", marker } } });
});

describe("Phase B claims/remedies PostgreSQL proof", () => {
  it("creates a valid customer claim and rejects an unrelated claimant", async () => {
    const claim = await createClaim({ claimantUserId: customerId, orderReference, reason: ClaimReason.DAMAGED, description: "The parcel arrived with visible damage.", operationId: claimOperationId("CREATE") });
    claimReference = claim.publicReference;
    expect(claim.status).toBe("OPEN");
    await expect(createClaim({ claimantUserId: unrelatedCustomerId, orderReference, reason: ClaimReason.DAMAGED, description: "An unrelated claimant must be rejected.", operationId: claimOperationId("UNRELATED") })).rejects.toMatchObject({ code: "CLAIM_FORBIDDEN" } satisfies Partial<ClaimDomainError>);
  });

  it("enforces duplicate claim behavior while allowing distinct reason taxonomy", async () => {
    await expect(createClaim({ claimantUserId: customerId, orderReference, reason: ClaimReason.DAMAGED, description: "A duplicate financial subject must not create a second open case.", operationId: claimOperationId("DUPLICATE") })).rejects.toMatchObject({ code: "CLAIM_DUPLICATE" } satisfies Partial<ClaimDomainError>);
    await expect(createClaim({ claimantUserId: customerId, orderReference, reason: ClaimReason.DELIVERY_ISSUE, description: "A distinct allegation remains independently investigable.", operationId: claimOperationId("DISTINCT") })).resolves.toMatchObject({ reason: ClaimReason.DELIVERY_ISSUE });
  });

  it("allows a later legitimate claim after a terminal case without reopening the historical case", async () => {
    await prisma.claim.update({ where: { publicReference: claimReference }, data: { status: "CLOSED" } });
    const reopened = await createClaim({ claimantUserId: customerId, orderReference, reason: ClaimReason.DAMAGED, description: "A new incident after the closed case is independently reportable.", operationId: claimOperationId("REOPEN") });
    expect(reopened).toMatchObject({ status: "OPEN", reason: ClaimReason.DAMAGED });
    claimReference = reopened.publicReference;
  });

  it("preserves claim-owned private evidence and rejects unrelated claim access", async () => {
    const claim = await prisma.claim.findUniqueOrThrow({ where: { publicReference: claimReference } });
    const media = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${randomUUID()}`, ownerType: PrivateMediaOwnerType.CLAIM, ownerId: claim.id, purpose: PrivateMediaPurpose.CLAIM_EVIDENCE, status: "READY", storageProvider: "TEST", storageKey: `private-media/${marker}`, originalFileName: "claim-proof.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 12, checksum: marker, createdByUserId: customerId } });
    await expect(addClaimEvidence({ publicReference: claimReference, actorUserId: customerId, role: UserRole.CUSTOMER, privateMediaReference: media.publicReference })).resolves.toMatchObject({ claimId: claim.id, privateMediaObjectId: media.id });
    await expect(getClaimForActor({ publicReference: claimReference, actorUserId: unrelatedCustomerId, role: UserRole.CUSTOMER })).rejects.toMatchObject({ code: "CLAIM_FORBIDDEN" } satisfies Partial<ClaimDomainError>);
  });

  it("keeps investigation history append-only at the PostgreSQL boundary", async () => {
    const activity = await prisma.claimActivity.findFirstOrThrow({ where: { claim: { publicReference: claimReference } }, orderBy: { createdAt: "asc" } });
    await expect(prisma.claimActivity.update({ where: { id: activity.id }, data: { safeDetail: "attempted mutation" } })).rejects.toThrow(/claim activity is append-only/);
    await expect(prisma.claimActivity.delete({ where: { id: activity.id } })).rejects.toThrow(/claim activity is append-only/);
  });

  it("delegates concurrent approved redelivery remedies to exactly one canonical Shipping request without creating a financial effect", async () => {
    const operationId = remedyOperationId("REDELIVERY");
    const input = { publicReference: claimReference, actorUserId: operatorId, actorRole: UserRole.SUPER_ADMIN, remedy: ClaimRemedyType.REDELIVERY, reason: "Approved operational redelivery after delivery issue.", operationId };
    const [first, second] = await Promise.all([decideClaimRemedy(input), decideClaimRemedy(input)]);
    expect(first.id).toBe(second.id);
    expect(first.type).toBe(ClaimRemedyType.REDELIVERY);
    const claim = await prisma.claim.findUniqueOrThrow({ where: { publicReference: claimReference } });
    const requests = await (prisma as any).redeliveryRequest.findMany({ where: { sourceClaimId: claim.id } });
    expect(requests).toHaveLength(1);
    expect(requests[0].remedyType).toBe("REDELIVERY");
    expect(first.paymentRefundId).toBeNull();
  });
});
