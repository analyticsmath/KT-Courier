import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus } from "@/types/db";
import { canTransitionAssignment, isCurrentAssignment } from "@/lib/dispatch/assignment-state-machine";

describe("dispatch assignment state machine", () => {
  it("permits offered lifecycle transitions and blocks terminal transitions", () => {
    expect(canTransitionAssignment(OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.ACCEPTED)).toBe(true);
    expect(canTransitionAssignment(OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.EXPIRED)).toBe(true);
    expect(canTransitionAssignment(OrderAssignmentStatus.ACCEPTED, OrderAssignmentStatus.SUPERSEDED)).toBe(true);
    expect(canTransitionAssignment(OrderAssignmentStatus.REJECTED, OrderAssignmentStatus.ACCEPTED)).toBe(false);
    expect(canTransitionAssignment(OrderAssignmentStatus.COMPLETED, OrderAssignmentStatus.REVOKED)).toBe(false);
  });
  it("identifies only offered and accepted assignments as current", () => {
    expect(isCurrentAssignment(OrderAssignmentStatus.ASSIGNED)).toBe(true);
    expect(isCurrentAssignment(OrderAssignmentStatus.ACCEPTED)).toBe(true);
    expect(isCurrentAssignment(OrderAssignmentStatus.EXPIRED)).toBe(false);
  });
});
