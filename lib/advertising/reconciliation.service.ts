import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class AdvertisingReconciliationService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async scanForReconciliationDiscrepancies() {
    const casesCreated = [];

    // 1. Scan for clicks charged without a valid measurement event
    const chargesWithoutEvent = await this.db.advertisingClickCharge.findMany({
      where: {
        measurementEvent: {
          validityStatus: { not: "VALID" }
        },
        status: "CHARGED"
      },
      include: { measurementEvent: true }
    });

    for (const c of chargesWithoutEvent) {
      const publicRef = `AD-REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const existing = await this.db.advertisingReconciliationCase.findFirst({
        where: { clickChargeId: c.id, reason: "CLICK_CHARGE_WITHOUT_VALID_EVENT" }
      });
      if (!existing) {
        const reconciliationCase = await this.db.advertisingReconciliationCase.create({
          data: {
            publicReference: publicRef,
            clickChargeId: c.id,
            reason: "CLICK_CHARGE_WITHOUT_VALID_EVENT",
            status: "OPEN",
            priority: "HIGH",
            safeSummary: `Click charge ${c.publicReference} has been billed but its measurement event is status ${c.measurementEvent.validityStatus}`,
            safeEvidence: { charge: c }
          }
        });
        casesCreated.push(reconciliationCase);
      }
    }

    // 2. Scan for valid click events that have no click charge record
    const validClicksWithoutCharge = await this.db.advertisingMeasurementEvent.findMany({
      where: {
        eventType: "CLICK",
        validityStatus: "VALID",
        clickCharges: { none: {} }
      },
      include: { campaignVersion: true }
    });

    for (const event of validClicksWithoutCharge) {
      // Check if funding allocation had budget at click time
      const allocations = await this.db.advertisingFundingAllocation.findMany({
        where: { campaignVersionId: event.campaignVersionId }
      });
      const remainingFunds = allocations.reduce((sum, alloc) => sum.add(alloc.remainingAmount), new Prisma.Decimal(0));
      if (remainingFunds.lte(0)) {
        // If funding was exhausted, not a reconciliation violation (VALID_NON_BILLABLE is expected, but check if validityStatus is VALID)
        continue;
      }

      const publicRef = `AD-REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const existing = await this.db.advertisingReconciliationCase.findFirst({
        where: { measurementEventId: event.id, reason: "VALID_CLICK_WITHOUT_CHARGE" }
      });
      if (!existing) {
        const reconciliationCase = await this.db.advertisingReconciliationCase.create({
          data: {
            publicReference: publicRef,
            measurementEventId: event.id,
            reason: "VALID_CLICK_WITHOUT_CHARGE",
            status: "OPEN",
            priority: "MEDIUM",
            safeSummary: `Valid click event ${event.publicReference} was recorded but never charged to any campaign budget.`,
            safeEvidence: { event }
          }
        });
        casesCreated.push(reconciliationCase);
      }
    }

    // 3. Scan for budget overruns (spend > total budget)
    const campaigns = await this.db.advertisingCampaign.findMany({
      include: {
        versions: {
          include: {
            clickCharges: {
              where: { status: "CHARGED" }
            }
          }
        }
      }
    });

    for (const cmp of campaigns) {
      for (const ver of cmp.versions) {
        const spend = ver.clickCharges.reduce((sum, c) => sum.add(c.chargeAmount), new Prisma.Decimal(0));
        if (spend.gt(ver.totalBudget)) {
          const publicRef = `AD-REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          const existing = await this.db.advertisingReconciliationCase.findFirst({
            where: { campaignVersionId: ver.id, reason: "CAMPAIGN_BUDGET_OVERRUN" }
          });
          if (!existing) {
            const reconciliationCase = await this.db.advertisingReconciliationCase.create({
              data: {
                publicReference: publicRef,
                campaignVersionId: ver.id,
                reason: "CAMPAIGN_BUDGET_OVERRUN",
                status: "OPEN",
                priority: "CRITICAL",
                safeSummary: `Campaign version ${ver.publicReference} has spent ${spend.toFixed(2)} exceeding total budget of ${ver.totalBudget.toFixed(2)}`,
                safeEvidence: { spend: spend.toFixed(2), totalBudget: ver.totalBudget.toFixed(2) }
              }
            });
            casesCreated.push(reconciliationCase);
          }
        }
      }
    }

    return casesCreated;
  }
}
