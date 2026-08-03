export class DispatchError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message);
    this.name = "DispatchError";
  }
}

export const dispatchError = {
  orderNotFound: () => new DispatchError("DISPATCH_ORDER_NOT_FOUND", "Order not found.", 404),
  orderNotAssignable: () => new DispatchError("DISPATCH_ORDER_NOT_ASSIGNABLE", "Order is not eligible for dispatch."),
  assignmentNotFound: () => new DispatchError("DISPATCH_ASSIGNMENT_NOT_FOUND", "Assignment not found.", 404),
  assignmentExists: () => new DispatchError("DISPATCH_ASSIGNMENT_EXISTS", "Order already has a current assignment."),
  stale: () => new DispatchError("DISPATCH_ASSIGNMENT_STALE", "Assignment changed before this action could be completed."),
  expired: () => new DispatchError("DISPATCH_ASSIGNMENT_EXPIRED", "This assignment offer has expired."),
  resolved: () => new DispatchError("DISPATCH_ASSIGNMENT_ALREADY_RESOLVED", "Assignment is already resolved."),
  driverIneligible: (reason: string) => new DispatchError("DISPATCH_DRIVER_INELIGIBLE", reason, 422),
  capacity: () => new DispatchError("DISPATCH_DRIVER_CAPACITY_REACHED", "Driver has reached assignment capacity."),
  custody: () => new DispatchError("DISPATCH_UNASSIGNMENT_BLOCKED", "Assignment cannot be changed after custody begins."),
};
