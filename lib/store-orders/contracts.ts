export type FrozenStoreOrder = Readonly<{
  id: string;
  publicReference: string;
  storeId: string;
  marketplaceOrderId: string;
  acceptanceStatus: string;
  preparationStatus: string;
  resolutionStatus: string;
  financialResolutionStatus: string;
  deliveryBridgeStatus: string;
  derivedStatus: string;
  reviewDeadlineAt: Date | null;
  acceptedPreparationMinutes: number | null;
  operationalPolicyReference: string | null;
  operationalPolicyVersion: number | null;
  operationalSnapshot: Record<string, unknown> | null;
}>;

export type StoreOrderFinancialAuthority = Readonly<{
  applyExactAdjustment(input: Readonly<{
    adjustmentReference: string;
    storeOrderReference: string;
    operationId: string;
    frozenEvidence: Record<string, unknown>;
  }>): Promise<Readonly<{ refundReference?: string; commissionReversalReferences: readonly string[]; storeEarningReversalReference?: string; financialStatus: "REFUND_RESERVED" | "REFUND_PROCESSING" | "REFUND_COMPLETED" }>>;
}>;

export type StoreOrderDeliveryAuthority = Readonly<{
  createCourierOrder(input: Readonly<{
    storeOrderReference: string;
    deliveryQuoteReference: string;
    deliveryQuoteVersion: string;
    operationId: string;
  }>): Promise<Readonly<{ courierOrderId: string; courierOrderReference: string }>>;
  scheduleDispatch?(input: Readonly<{
    storeOrderReference: string;
    courierOrderId: string;
    expectedReadyAt: Date;
    operationId: string;
  }>): Promise<Readonly<{ dispatchEvidence: Record<string, unknown> }>>;
}>;

export type StoreOrderPickupAuthority = Readonly<{
  completeCanonicalPickup(input: Readonly<{
    assignmentId: string;
    assignmentVersion: number;
    driverProfileId: string;
    driverUserId: string;
    operationId: string;
    packageCount: number;
  }>): Promise<void>;
}>;

/** Test-only adapters make source-lock behaviour executable without providers. */
export type StoreOrderDependencies = Readonly<{
  financialAuthority?: StoreOrderFinancialAuthority;
  deliveryAuthority?: StoreOrderDeliveryAuthority;
  pickupAuthority?: StoreOrderPickupAuthority;
}>;
