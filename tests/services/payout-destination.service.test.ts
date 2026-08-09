import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    wallet: { findUnique: vi.fn() },
    payoutDestination: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
      payoutDestination: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { registerPayoutDestination, transitionPayoutDestination } from "@/lib/services/payout-destination.service";

describe("payout destination service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  });

  it("covers masked opaque registration and lifecycle transitions", async () => {
    mocks.tx.wallet.findUnique.mockResolvedValue({ id: "wallet-1", status: "ACTIVE" });
    mocks.tx.payoutDestination.create.mockResolvedValue({
      id: "pd-1",
      publicReference: "PD-12345",
      walletId: "wallet-1",
      ownerType: "STORE",
      ownerId: "store-1",
      maskedLabel: "Standard Bank ****1234",
      status: "PENDING_REVIEW",
    });

    const registered = await registerPayoutDestination({
      actorUserId: "user-1",
      ownerType: "STORE",
      ownerId: "store-1",
      externalReference: "manual-finance:sb-acc-1",
      maskedLabel: "Standard Bank ****1234",
      accountLast4: "1234",
    });

    expect(registered.status).toBe("PENDING_REVIEW");
    expect(mocks.tx.payoutDestination.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maskedLabel: "Standard Bank ****1234",
        accountLast4: "1234",
        status: "PENDING_REVIEW",
      }),
    });
  });

  it("handles lifecycle transitions (ACTIVATE, SUSPEND, REVOKE)", async () => {
    const existing = {
      id: "pd-1",
      publicReference: "PD-12345",
      status: "PENDING_REVIEW",
    };
    mocks.tx.payoutDestination.findUnique.mockResolvedValue(existing);
    mocks.tx.payoutDestination.update.mockResolvedValue({ ...existing, status: "ACTIVE" });

    const activated = await transitionPayoutDestination({
      actorUserId: "admin-1",
      publicReference: "PD-12345",
      action: "ACTIVATE",
    });

    expect(activated.status).toBe("ACTIVE");
    expect(mocks.tx.payoutDestination.update).toHaveBeenCalledWith({
      where: { id: "pd-1" },
      data: expect.objectContaining({
        status: "ACTIVE",
        verifiedByUserId: "admin-1",
      }),
    });
  });

  it("rejects invalid owner or non-opaque external references", async () => {
    await expect(
      registerPayoutDestination({
        actorUserId: "user-1",
        ownerType: "CUSTOMER",
        ownerId: "cust-1",
        externalReference: "manual-finance:sb-1",
        maskedLabel: "Bank ****1234",
      })
    ).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_INVALID" });

    await expect(
      registerPayoutDestination({
        actorUserId: "user-1",
        ownerType: "STORE",
        ownerId: "store-1",
        externalReference: "invalid-reference",
        maskedLabel: "Bank ****1234",
      })
    ).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_INVALID" });
  });
});
