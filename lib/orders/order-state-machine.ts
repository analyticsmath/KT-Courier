import { OrderStatus, UserRole } from "@/types/db";

export type OrderTransitionActorRole = UserRole | "SYSTEM";

export type OrderTransitionContext = {
  hasAssignment?: boolean;
  hasAcceptedAssignment?: boolean;
  hasPickupProof?: boolean;
  hasDeliveryProof?: boolean;
  hasValidDeliveryOtp?: boolean;
  isPaid?: boolean;
  cancellationWindowOpen?: boolean;
  actorOwnsOrder?: boolean;
  actorOwnsStore?: boolean;
  actorIsAssignedDriver?: boolean;
  allowAdminOverride?: boolean;
  reason?: string | null;
};

export type OrderTransitionErrorCode =
  | "INVALID_TRANSITION"
  | "TERMINAL_STATUS"
  | "FORBIDDEN"
  | "REASON_REQUIRED";

export class OrderTransitionError extends Error {
  constructor(
    message: string,
    public readonly code: OrderTransitionErrorCode = "INVALID_TRANSITION"
  ) {
    super(message);
    this.name = "OrderTransitionError";
  }
}

export const TERMINAL_ORDER_STATUSES = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
] as const satisfies readonly OrderStatus[];

export const ACTIVE_ORDER_STATUSES = [
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PROGRESS,
  OrderStatus.PICKUP_SCHEDULED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERY_ATTEMPTED,
] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PICKUP_SCHEDULED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.IN_PROGRESS]: [
    OrderStatus.DELIVERY_ATTEMPTED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.PICKUP_SCHEDULED]: [
    OrderStatus.PICKED_UP,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.PICKED_UP]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERY_ATTEMPTED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.DELIVERY_ATTEMPTED,
    OrderStatus.DELIVERED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.DELIVERY_ATTEMPTED]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
};

const CUSTOMER_CANCEL_STATUSES = new Set<OrderStatus>([
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

const STORE_CANCEL_STATUSES = new Set<OrderStatus>([
  OrderStatus.DRAFT,
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

function isAdminActor(role: OrderTransitionActorRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

function isSystemActor(role: OrderTransitionActorRole): boolean {
  return role === "SYSTEM";
}

function isAdminOrSystem(role: OrderTransitionActorRole): boolean {
  return isAdminActor(role) || isSystemActor(role);
}

function hasReason(context?: OrderTransitionContext): boolean {
  return typeof context?.reason === "string" && context.reason.trim().length > 0;
}

function isReasonRequiredStatus(status: OrderStatus): boolean {
  return status === OrderStatus.CANCELLED || status === OrderStatus.FAILED;
}

function uniqueStatuses(statuses: OrderStatus[]): OrderStatus[] {
  return Array.from(new Set(statuses));
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(
    status as (typeof TERMINAL_ORDER_STATUSES)[number]
  );
}

function baseAllows(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

function customerAllowedTransitions(
  from: OrderStatus,
  context?: OrderTransitionContext
): OrderStatus[] {
  if (context?.actorOwnsOrder !== true) return [];
  if (context?.cancellationWindowOpen === false) return [];
  if (!CUSTOMER_CANCEL_STATUSES.has(from)) return [];
  return [OrderStatus.CANCELLED];
}

function storeAllowedTransitions(
  from: OrderStatus,
  context?: OrderTransitionContext
): OrderStatus[] {
  if (context?.actorOwnsStore !== true) return [];
  if (context?.cancellationWindowOpen === false) return [];
  if (!STORE_CANCEL_STATUSES.has(from)) return [];
  return [OrderStatus.CANCELLED];
}

function driverAllowedTransitions(
  from: OrderStatus,
  context?: OrderTransitionContext
): OrderStatus[] {
  if (
    context?.actorIsAssignedDriver !== true ||
    context.hasAcceptedAssignment !== true
  ) {
    return [];
  }

  const canCompleteDelivery =
    context.hasValidDeliveryOtp === true || context.hasDeliveryProof === true;

  switch (from) {
    case OrderStatus.CONFIRMED:
      return [OrderStatus.PICKUP_SCHEDULED];
    case OrderStatus.PICKUP_SCHEDULED:
      return [OrderStatus.PICKED_UP];
    case OrderStatus.PICKED_UP:
      return [
        OrderStatus.IN_TRANSIT,
        OrderStatus.DELIVERY_ATTEMPTED,
        OrderStatus.FAILED,
      ];
    case OrderStatus.IN_TRANSIT:
      return [
        OrderStatus.DELIVERY_ATTEMPTED,
        ...(canCompleteDelivery ? [OrderStatus.DELIVERED] : []),
        OrderStatus.FAILED,
      ];
    case OrderStatus.DELIVERY_ATTEMPTED:
      return [
        OrderStatus.IN_TRANSIT,
        ...(canCompleteDelivery ? [OrderStatus.DELIVERED] : []),
        OrderStatus.FAILED,
      ];
    default:
      return [];
  }
}

function adminAllowedTransitions(
  from: OrderStatus,
  context?: OrderTransitionContext
): OrderStatus[] {
  const transitions = [...(ORDER_STATUS_TRANSITIONS[from] ?? [])];

  if (!isTerminalOrderStatus(from)) {
    transitions.push(OrderStatus.CANCELLED);
  }

  if (context?.allowAdminOverride === true && !isTerminalOrderStatus(from)) {
    transitions.push(...(ORDER_STATUS_TRANSITIONS[from] ?? []));
  }

  return uniqueStatuses(transitions);
}

export function getAllowedOrderTransitions(args: {
  from: OrderStatus;
  actorRole: OrderTransitionActorRole;
  context?: OrderTransitionContext;
}): OrderStatus[] {
  if (isTerminalOrderStatus(args.from)) return [];

  switch (args.actorRole) {
    case UserRole.CUSTOMER:
      return customerAllowedTransitions(args.from, args.context);
    case UserRole.STORE:
      return storeAllowedTransitions(args.from, args.context);
    case UserRole.DRIVER:
      return driverAllowedTransitions(args.from, args.context);
    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      return adminAllowedTransitions(args.from, args.context);
    case "SYSTEM":
      return ORDER_STATUS_TRANSITIONS[args.from] ?? [];
    case UserRole.PROMOTER:
      return [];
    default:
      return [];
  }
}

function isAdminOverrideTransition(args: {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: OrderTransitionActorRole;
  context?: OrderTransitionContext;
}): boolean {
  if (!isAdminActor(args.actorRole)) return false;
  if (!args.context?.allowAdminOverride) return false;
  return !baseAllows(args.from, args.to);
}

export function canTransitionOrderStatus(args: {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: OrderTransitionActorRole;
  context?: OrderTransitionContext;
}): boolean {
  if (args.from === args.to) return true;
  if (isTerminalOrderStatus(args.from)) return false;

  const allowed = getAllowedOrderTransitions({
    from: args.from,
    actorRole: args.actorRole,
    context: args.context,
  });

  if (!allowed.includes(args.to)) return false;

  if (
    isAdminOrSystem(args.actorRole) &&
    isReasonRequiredStatus(args.to) &&
    args.actorRole !== "SYSTEM" &&
    !hasReason(args.context)
  ) {
    return false;
  }

  if (isAdminOverrideTransition(args) && !hasReason(args.context)) {
    return false;
  }

  return true;
}

export function assertOrderStatusTransition(args: {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: OrderTransitionActorRole;
  context?: OrderTransitionContext;
}): void {
  if (args.from === args.to) return;

  if (isTerminalOrderStatus(args.from)) {
    throw new OrderTransitionError(
      `Order is terminal in status ${args.from} and cannot transition to ${args.to}.`,
      "TERMINAL_STATUS"
    );
  }

  const allowed = getAllowedOrderTransitions({
    from: args.from,
    actorRole: args.actorRole,
    context: args.context,
  });

  if (!allowed.includes(args.to)) {
    throw new OrderTransitionError(
      `Cannot change order status from ${args.from} to ${args.to} as ${args.actorRole}.`,
      "INVALID_TRANSITION"
    );
  }

  if (
    isAdminOrSystem(args.actorRole) &&
    isReasonRequiredStatus(args.to) &&
    args.actorRole !== "SYSTEM" &&
    !hasReason(args.context)
  ) {
    throw new OrderTransitionError(
      `A reason is required to change order status to ${args.to}.`,
      "REASON_REQUIRED"
    );
  }

  if (isAdminOverrideTransition(args) && !hasReason(args.context)) {
    throw new OrderTransitionError(
      "A reason is required for admin override transitions.",
      "REASON_REQUIRED"
    );
  }
}
