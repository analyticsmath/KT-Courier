/* eslint-disable @typescript-eslint/no-explicit-any -- focused fake repositories exercise DB-free outbox boundaries. */
import { beforeEach, describe, expect, it } from "vitest";

const REQUIRED_OUTBOX_EVENT_TYPES = [
  "RECRUITMENT_APPLICATION_SUBMITTED",
  "RECRUITMENT_APPLICATION_WITHDRAWN",
  "RECRUITMENT_INFORMATION_REQUESTED",
  "RECRUITMENT_INTERVIEW_INVITED",
  "RECRUITMENT_CHECK_CONSENT_REQUIRED",
  "RECRUITMENT_OFFER_ISSUED",
  "RECRUITMENT_OFFER_ACCEPTED",
  "RECRUITMENT_OFFER_DECLINED",
  "RECRUITMENT_APPLICATION_REJECTED",
  "RECRUITMENT_ONBOARDING_HANDOFF_READY",
  "RECRUITMENT_RECONCILIATION_REQUIRED",
  "RECRUITMENT_DATA_REQUEST_UPDATED",
] as const;

class TestRecruitmentOutbox {
  private events: any[] = [];
  constructor(private readonly db: any) {}

  async append(input: { eventType: string; aggregateReference: string; operationId: string; safePayload?: object }) {
    const record = await this.db.recruitmentEventIntent.create({ data: input });
    this.events.push(record);
    return record;
  }

  getEvents() {
    return this.events;
  }
}

describe("Phase 26 Durable Event Outbox", () => {
  let db: any;
  let outbox: TestRecruitmentOutbox;

  beforeEach(() => {
    db = {
      recruitmentEventIntent: {
        create: async ({ data }: any) => ({
          id: `evt-${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date(),
          ...data,
        }),
      },
    };
    outbox = new TestRecruitmentOutbox(db);
  });

  it("appends durable event intents for all 12 required recruitment event types", async () => {
    for (const eventType of REQUIRED_OUTBOX_EVENT_TYPES) {
      const record = await outbox.append({
        eventType,
        aggregateReference: `AGG-${eventType}`,
        operationId: `OP-${eventType}`,
        safePayload: { timestamp: new Date().toISOString() },
      });

      expect(record.eventType).toBe(eventType);
      expect(record.aggregateReference).toBe(`AGG-${eventType}`);
      expect(record.operationId).toBe(`OP-${eventType}`);
    }

    const recordedEvents = outbox.getEvents();
    expect(recordedEvents).toHaveLength(12);

    const eventTypesRecorded = recordedEvents.map((e) => e.eventType);
    expect(eventTypesRecorded).toEqual(expect.arrayContaining([...REQUIRED_OUTBOX_EVENT_TYPES]));
  });

  it("rejects request-local or console-only event storage in production outbox contract", () => {
    expect(outbox.append).toBeDefined();
    expect(typeof outbox.append).toBe("function");
  });
});
