import { describe, expect, it } from "vitest";
import {
  assertContractTransition,
  assertSubscriptionSubject,
  terminalSubscriptionContractStatuses,
} from "@/lib/subscriptions/contract-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

describe("Subscription Contract Domain Integration Tests", () => {
  it("enforces customer subject constraints strictly", () => {
    // Valid customer subject
    expect(() =>
      assertSubscriptionSubject({
        subjectType: "CUSTOMER",
        customerUserId: "cust-1",
        storeId: null,
        payerUserId: "cust-1",
      })
    ).not.toThrow();

    // Payer is not customer
    expect(() =>
      assertSubscriptionSubject({
        subjectType: "CUSTOMER",
        customerUserId: "cust-1",
        storeId: null,
        payerUserId: "other-user",
      })
    ).toThrowError(SubscriptionError);

    // Customer subscription cannot specify storeId
    expect(() =>
      assertSubscriptionSubject({
        subjectType: "CUSTOMER",
        customerUserId: "cust-1",
        storeId: "store-1",
        payerUserId: "cust-1",
      })
    ).toThrowError(SubscriptionError);
  });

  it("enforces store subject constraints strictly", () => {
    // Valid store subject
    expect(() =>
      assertSubscriptionSubject({
        subjectType: "STORE",
        customerUserId: null,
        storeId: "store-1",
        payerUserId: "store-owner-1",
        storePayerAuthorised: true,
      })
    ).not.toThrow();

    // Unauthorized store billing actor
    expect(() =>
      assertSubscriptionSubject({
        subjectType: "STORE",
        customerUserId: null,
        storeId: "store-1",
        payerUserId: "stranger",
        storePayerAuthorised: false,
      })
    ).toThrowError(SubscriptionError);
  });

  it("enforces legal contract state transitions", () => {
    expect(() => assertContractTransition("DRAFT", "PENDING_REVIEW")).not.toThrow();
    expect(() => assertContractTransition("ACTIVE", "PAST_DUE")).not.toThrow();
    expect(() => assertContractTransition("ACTIVE", "PAUSED")).not.toThrow();
    expect(() => assertContractTransition("ACTIVE", "CANCELLATION_SCHEDULED")).not.toThrow();

    // Illegal transitions
    expect(() => assertContractTransition("DRAFT", "ACTIVE")).toThrowError(/Contract cannot move from DRAFT to ACTIVE/);
    expect(() => assertContractTransition("CANCELLED", "ACTIVE")).toThrowError(/Contract cannot move from CANCELLED to ACTIVE/);
  });

  it("recognizes terminal contract statuses", () => {
    expect(terminalSubscriptionContractStatuses.has("CANCELLED")).toBe(true);
    expect(terminalSubscriptionContractStatuses.has("EXPIRED")).toBe(true);
    expect(terminalSubscriptionContractStatuses.has("ACTIVE")).toBe(false);
  });
});
