import { createHash } from "node:crypto";
import { DriverEarningError } from "./errors";

export const DRIVER_EARNING_SUBJECT_TYPE = "COURIER_DELIVERY" as const;
const SAFE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export function assignmentPublicReference(assignmentId: string): string {
  if (!SAFE.test(assignmentId)) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Assignment identity is invalid.");
  return `ASG-${createHash("sha256").update(assignmentId).digest("hex").slice(0, 24).toUpperCase()}`;
}

export function assertDriverEarningSubject(input: Readonly<{ subjectType: string; subjectId: string; subjectPublicReference: string; assignmentId: string; assignmentPublicReference: string; assignmentVersion: string }>): void {
  if (input.subjectType !== DRIVER_EARNING_SUBJECT_TYPE || input.subjectId !== input.assignmentId || ![input.subjectId, input.subjectPublicReference, input.assignmentId, input.assignmentPublicReference, input.assignmentVersion].every((value) => SAFE.test(value))) {
    throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Driver earning subject identity is invalid.");
  }
  if (input.assignmentPublicReference !== assignmentPublicReference(input.assignmentId)) throw new DriverEarningError("DRIVER_EARNING_ASSIGNMENT_INVALID", "Assignment public reference is not canonical.");
}
