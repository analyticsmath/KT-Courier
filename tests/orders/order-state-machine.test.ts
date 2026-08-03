import { describe, expect, it } from "vitest";
import { OrderStatus, UserRole } from "@/types/db";
import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
  getAllowedOrderTransitions,
  isTerminalOrderStatus,
  OrderTransitionError,
  TERMINAL_ORDER_STATUSES,
} from "@/lib/orders/order-state-machine";

describe("order state machine", () => {
  it("marks the terminal order statuses as terminal", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(true);
    }

    expect(isTerminalOrderStatus(OrderStatus.IN_TRANSIT)).toBe(false);
  });

  it("treats same-status transitions as idempotent no-ops", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.PENDING,
        actorRole: UserRole.CUSTOMER,
      })
    ).toBe(true);

    expect(() =>
      assertOrderStatusTransition({
        from: OrderStatus.PENDING,
        to: OrderStatus.PENDING,
        actorRole: UserRole.CUSTOMER,
      })
    ).not.toThrow();
  });

  it("allows early-stage customer cancellation only for owned orders", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.CUSTOMER,
        context: { actorOwnsOrder: true },
      })
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.CUSTOMER,
        context: { actorOwnsOrder: false },
      })
    ).toBe(false);
  });

  it("denies customer cancellation after pickup has started", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PICKUP_SCHEDULED,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.CUSTOMER,
        context: { actorOwnsOrder: true },
      })
    ).toBe(false);
  });

  it("denies store cancellation after pickup completion", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PICKED_UP,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.STORE,
        context: { actorOwnsStore: true },
      })
    ).toBe(false);
  });

  it("allows assigned drivers to start pickup", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.CONFIRMED,
        to: OrderStatus.PICKUP_SCHEDULED,
        actorRole: UserRole.DRIVER,
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
        },
      })
    ).toBe(true);
  });

  it("denies driver transitions for another driver's order", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.CONFIRMED,
        to: OrderStatus.PICKUP_SCHEDULED,
        actorRole: UserRole.DRIVER,
        context: {
          actorIsAssignedDriver: false,
          hasAcceptedAssignment: true,
        },
      })
    ).toBe(false);
  });

  it("denies driver cancellation of the whole order", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.CONFIRMED,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.DRIVER,
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
        },
      })
    ).toBe(false);
  });

  it("allows admin status management with required cancellation reason", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.CONFIRMED,
        actorRole: UserRole.ADMIN,
      })
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        from: OrderStatus.CONFIRMED,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.ADMIN,
      })
    ).toBe(false);

    expect(
      canTransitionOrderStatus({
        from: OrderStatus.CONFIRMED,
        to: OrderStatus.CANCELLED,
        actorRole: UserRole.ADMIN,
        context: { reason: "Customer requested admin cancellation." },
      })
    ).toBe(true);
  });

  it("requires a reason for admin failure transitions", () => {
    expect(() =>
      assertOrderStatusTransition({
        from: OrderStatus.IN_TRANSIT,
        to: OrderStatus.FAILED,
        actorRole: UserRole.ADMIN,
      })
    ).toThrow(OrderTransitionError);

    expect(() =>
      assertOrderStatusTransition({
        from: OrderStatus.IN_TRANSIT,
        to: OrderStatus.FAILED,
        actorRole: UserRole.ADMIN,
        context: { reason: "Recipient unreachable after escalation." },
      })
    ).not.toThrow();
  });

  it("blocks terminal orders from returning to active states", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.DELIVERED,
        to: OrderStatus.IN_TRANSIT,
        actorRole: UserRole.SUPER_ADMIN,
        context: { allowAdminOverride: true, reason: "Correction" },
      })
    ).toBe(false);
  });

  it("rejects invalid actor-specific transitions", () => {
    expect(
      canTransitionOrderStatus({
        from: OrderStatus.PENDING,
        to: OrderStatus.CONFIRMED,
        actorRole: UserRole.CUSTOMER,
        context: { actorOwnsOrder: true },
      })
    ).toBe(false);
  });

  it("returns allowed transitions for an actor and context", () => {
    expect(
      getAllowedOrderTransitions({
        from: OrderStatus.IN_TRANSIT,
        actorRole: UserRole.DRIVER,
        context: {
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          hasValidDeliveryOtp: true,
        },
      })
    ).toEqual([
      OrderStatus.DELIVERY_ATTEMPTED,
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
    ]);
  });

  it("does not allow PROMOTER to act as customer, store, driver, or admin", () => {
    expect(
      getAllowedOrderTransitions({
        from: OrderStatus.PENDING,
        actorRole: UserRole.PROMOTER,
        context: {
          actorOwnsOrder: true,
          actorOwnsStore: true,
          actorIsAssignedDriver: true,
          hasAcceptedAssignment: true,
          allowAdminOverride: true,
          reason: "Should not matter.",
        },
      })
    ).toEqual([]);
  });
});
