import { storeAccess } from "@/lib/client-platform/store-access";
import { resolveStorePickupSuburb } from "@/lib/marketplace-checkout/store-pickup-selection";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { OrderSource, OrderStatus } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import { generateOrderNumber } from "@/lib/utils/order-number";
import {
  toOrderSummaryDto,
  toOrderDetailDto,
  type OrderSummaryDto,
  type OrderDetailDto,
  type UserOrderCountsDto,
} from "@/lib/dto/order.dto";
import type {
  CreateOrderInput,
  CustomerCancelOrderInput,
} from "@/lib/validation/order";
import {
  appendCourierBookingPendingPaymentInTx,
  appendCourierOrderAcceptedInTx,
  appendOrderConfirmedInTx,
} from "./notification-events.service";
import {
  emitAdminAlertNonBlocking,
  recordAdminAlertIntentInTx,
  type AdminAlertEventInput,
} from "@/lib/notifications/admin-alert-dispatch.service";
import {
  hashPricingInput,
  pricingInputSnapshot,
} from "@/lib/pricing/input-hash";
import { ownedActiveQuoteForOrder } from "@/lib/services/pricing-quote.service";
import { canTransitionOrderStatus } from "@/lib/orders/order-state-machine";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";
import { resolvePaymentBreakdown } from "@/lib/payments/payment-policy.service";
import { assertParcelPaymentChoice, assertSelectedPaymentMode } from "@/lib/payments/parcel-payment-method-selection";
import { createCashOnDeliveryObligationWithinTransaction } from "@/lib/services/cash-on-delivery.service";
import { initialCourierBookingStatus } from "@/lib/orders/courier-confirmation-policy";
import { releaseParcelOrderWalletReservationWithinTransaction } from "@/lib/services/wallet-spending.service";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";
import { openPaymentReconciliationCaseWithinTransaction } from "@/lib/services/payment-reconciliation.service";
import {
  cancelUncollectedCodObligationInTx,
  cancellationRequestHash,
  extractParcelWalletSplit,
  hasUnresolvedProviderActivity,
  revokePendingDispatchOffersInTx,
  settlePaidOrderCancellationInTx,
  toCancellationResolutionSummary,
  UNRESOLVED_ATTEMPT_STATUSES,
  upsertParcelCancellationResolutionInTx,
  type CancellationResolutionSummaryDto,
} from "@/lib/orders/parcel-cancellation-coordinator.service";

// ─── Full include for order queries ──────────────────────────────────────────

const ORDER_FULL_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
  statusHistory: {
    include: { actorUser: true },
    orderBy: { createdAt: "asc" as const },
  },
  customer: true,
  store: true,
} as const;

const ORDER_LIST_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createOrder(
  user: AuthenticatedUser,
  input: CreateOrderInput,
  business = user.role === "STORE",
  transaction?: Prisma.TransactionClient,
  explicitStoreId?: string | null,
): Promise<OrderDetailDto> {
  let storeId: string | null = null;
  let customerId: string | null = null;
  let source: OrderSource;

  if (business) {
    storeId = (
      await (explicitStoreId
        ? storeAccess(user.id, "deliveries", explicitStoreId)
        : storeAccess(user.id, "deliveries"))
    ).store.id;
    if (!storeId) throw new Error("No store found for this account.");
    source = OrderSource.STORE;
  } else if (user.role === "CUSTOMER") {
    customerId = user.id;
    source = OrderSource.CUSTOMER;
  } else {
    throw new Error("Only customers and store accounts can create orders.");
  }

  const orderNumber = await generateOrderNumber();
  // Must match the input snapshot created by the quote endpoint. Pricing inputs
  // are never accepted as order fields, only the quote identifier is.
  const quoteInputHash = hashPricingInput(pricingInputSnapshot(input));

  const persist = async (tx: Prisma.TransactionClient) => {
    const quote = await ownedActiveQuoteForOrder(
      tx,
      user,
      input.pricingQuoteId,
      quoteInputHash,
      storeId,
    );
    const ruleSnapshot = quote.ruleSnapshot as {
      serviceKey?: string;
      configurationId?: string;
    };
    assertParcelPaymentChoice(input.deliveryType, input.paymentMethod);
    const committedPayment =
      input.paymentMethod && input.paymentMethod !== "DIGITAL_ONLY"
        ? await resolvePaymentBreakdown(
            {
              storeId,
              orderType: input.deliveryType,
              deliveryServiceId: ruleSnapshot.configurationId,
              deliveryServiceKey: ruleSnapshot.serviceKey,
              provinces: [
                input.pickupAddress.province,
                input.dropoffAddress.province,
              ].filter((v): v is string => !!v),
              regionId: quote.destinationRegionId,
              originRegionId: quote.originRegionId,
              destinationRegionId: quote.destinationRegionId,
              originLocality: {
                city: input.pickupAddress.city,
                suburb: resolveStorePickupSuburb(input.pickupAddress),
                province: input.pickupAddress.province,
              },
              destinationLocality: {
                city: input.dropoffAddress.city,
                suburb: resolveStorePickupSuburb(input.dropoffAddress),
                province: input.dropoffAddress.province,
              },
              authoritativeTotal: quote.total.toFixed(2),
            },
            tx,
          )
        : null;
    assertSelectedPaymentMode(input.paymentMethod, committedPayment?.mode);
    const bookingStatus = initialCourierBookingStatus(committedPayment);
    const pickup = await tx.address.create({
      data: {
        type: "PICKUP",
        contactName: input.pickupAddress.contactName ?? null,
        contactPhone: input.pickupAddress.contactPhone ?? null,
        line1: input.pickupAddress.line1,
        line2: input.pickupAddress.line2 ?? null,
        suburb: input.pickupAddress.suburb ?? null,
        city: input.pickupAddress.city ?? null,
        province: input.pickupAddress.province ?? null,
        postalCode: input.pickupAddress.postalCode ?? null,
        country: input.pickupAddress.country ?? "South Africa",
        accessNotes: input.pickupAddress.accessNotes ?? null,
        formattedAddress: input.pickupAddress.formattedAddress ?? null,
        placeId: input.pickupAddress.placeId ?? null,
        latitude: input.pickupAddress.latitude ?? null,
        longitude: input.pickupAddress.longitude ?? null,
      },
    });

    const dropoff = await tx.address.create({
      data: {
        type: "DROPOFF",
        contactName: input.dropoffAddress.contactName ?? input.recipientName,
        contactPhone: input.dropoffAddress.contactPhone ?? input.recipientPhone,
        line1: input.dropoffAddress.line1,
        line2: input.dropoffAddress.line2 ?? null,
        suburb: input.dropoffAddress.suburb ?? null,
        city: input.dropoffAddress.city ?? null,
        province: input.dropoffAddress.province ?? null,
        postalCode: input.dropoffAddress.postalCode ?? null,
        country: input.dropoffAddress.country ?? "South Africa",
        accessNotes: input.dropoffAddress.accessNotes ?? null,
        formattedAddress: input.dropoffAddress.formattedAddress ?? null,
        placeId: input.dropoffAddress.placeId ?? null,
        latitude: input.dropoffAddress.latitude ?? null,
        longitude: input.dropoffAddress.longitude ?? null,
      },
    });

    const createdAt = new Date();
    const paymentDueAt =
      bookingStatus === OrderStatus.PENDING
        ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
        : null;

    const order = await tx.order.create({
      data: {
        orderNumber,
        source,
        status: bookingStatus,
        deliveryType: input.deliveryType,
        currency: quote.currency,
        customerId,
        storeId,
        pickupAddressId: pickup.id,
        dropoffAddressId: dropoff.id,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail ?? null,
        parcelDescription: input.parcelDescription ?? null,
        parcelCount: input.parcelCount,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        createdAt,
        paymentDueAt,
        priceEstimate: quote.total,
        pricingQuoteId: quote.id,
        pricingSubtotal: quote.subtotal,
        pricingTaxAmount: quote.taxAmount,
        pricingTaxRate: quote.taxRate,
        pricingSnapshot: {
          senderContact: { email: input.senderEmail ?? null },
          quoteId: quote.id,
          calculationVersion: quote.calculationVersion,
          input: quote.inputSnapshot,
          rule: quote.ruleSnapshot,
          regions: quote.regionSnapshot,
          tax: quote.taxSnapshot,
          lineItems: quote.lineItems.map((item) => ({
            code: item.code,
            label: item.label,
            quantity: item.quantity?.toString() ?? null,
            unitRate: item.unitRate?.toString() ?? null,
            amount: item.amount.toFixed(2),
            currency: item.currency,
          })),
          paymentPolicy: committedPayment
            ? {
                ...committedPayment.policyEvidence,
                digitalRequired: committedPayment.digitalRequired,
                cashRequired: committedPayment.cashRequired,
              }
            : null,
        },
        customerNote: input.customerNote ?? null,
        distanceMeters: quote.distanceMeters,
        durationSeconds: quote.durationSeconds,
        routeSummary:
          (quote.metadata as { routeSummary?: string } | null)?.routeSummary ??
          null,
        routeProvider: quote.routeProvider,
        routeCalculatedAt: quote.createdAt,
        deliveryRegionId: quote.destinationRegionId,
      },
      include: ORDER_FULL_INCLUDE,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: bookingStatus,
        note: bookingStatus === OrderStatus.CONFIRMED
          ? "Approved full cash-on-delivery booking accepted; payment remains due on delivery."
          : "Order created; digital payment is pending.",
        actorUserId: user.id,
      },
    });
    if (committedPayment && committedPayment.mode !== "DIGITAL_ONLY") {
      await createCashOnDeliveryObligationWithinTransaction(tx, {
        orderId: order.id,
        policyMode: committedPayment.mode,
        authoritativePayable: committedPayment.authoritativeTotal,
        digitalRequired: committedPayment.digitalRequired,
        policyEvidence: committedPayment.policyEvidence,
      });
    }

    let bookingAdminAlert: AdminAlertEventInput;
    if (bookingStatus === OrderStatus.CONFIRMED) {
      await appendOrderConfirmedInTx(tx, order);
      await appendCourierOrderAcceptedInTx(tx, {
        ...order,
        paymentMode: "FULL_COD",
        depositPaidZar: "0.00",
        cashDueZar: committedPayment?.cashRequired ?? quote.total.toFixed(2),
      });
      const cashDue = committedPayment?.cashRequired ?? quote.total.toFixed(2);
      bookingAdminAlert = {
        eventType: "PARCEL_ORDER_ACCEPTED",
        aggregateReference: `parcel-accepted:${order.id}`,
        title: `Approved COD parcel accepted (${order.orderNumber})`,
        summary: `Full COD parcel booking ${order.orderNumber} accepted under approved cash terms; R${cashDue} cash due to driver at delivery.`,
        adminPath: `/admin/orders/${order.id}`,
        relatedOrderId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          paymentMode: committedPayment?.mode ?? "FULL_COD",
          cashDueZar: cashDue,
          status: order.status,
        },
      };
    } else {
      await appendCourierBookingPendingPaymentInTx(tx, order);
      bookingAdminAlert = {
        eventType: "PARCEL_ORDER_CREATED",
        aggregateReference: `parcel-created:${order.id}`,
        title: `New parcel booking pending payment (${order.orderNumber})`,
        summary: `Booking ${order.orderNumber} requires verified payment before ${paymentDueAt?.toISOString() ?? "deadline"}.`,
        adminPath: `/admin/orders/${order.id}`,
        relatedOrderId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          paymentMode: committedPayment?.mode ?? "DIGITAL_ONLY",
          status: order.status,
        },
      };
    }
    await recordAdminAlertIntentInTx(tx, bookingAdminAlert);
    return { order, bookingAdminAlert };
  };
  const { order: result, bookingAdminAlert } = transaction
    ? await persist(transaction)
    : await prisma.$transaction(persist);

  if (!transaction && bookingAdminAlert) {
    void emitAdminAlertNonBlocking(bookingAdminAlert);
  }

  const dto = toOrderDetailDto(result);

  return dto;
}

// ─── List (customer or store) ─────────────────────────────────────────────────

export interface OrderListFilters {
  status?: OrderStatus;
  page: number;
  pageSize: number;
}

export async function listOrders(
  user: AuthenticatedUser,
  filters: OrderListFilters,
  business = user.role === "STORE",
  explicitStoreId?: string | null,
): Promise<{ data: OrderSummaryDto[]; total: number }> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where = await buildOwnerWhere(user, business, explicitStoreId);
  if (filters.status)
    (where as Record<string, unknown>).status = filters.status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { data: orders.map(toOrderSummaryDto), total };
}

// ─── Get single order (ownership enforced) ───────────────────────────────────

export async function getOrder(
  user: AuthenticatedUser,
  orderId: string,
  business = user.role === "STORE",
  explicitStoreId?: string | null,
): Promise<OrderDetailDto | null> {
  const where = await buildOwnerWhere(user, business, explicitStoreId);
  (where as Record<string, unknown>).id = orderId;

  const order = await prisma.order.findFirst({
    where,
    include: ORDER_FULL_INCLUDE,
  });

  return order ? toOrderDetailDto(order) : null;
}

// ─── Repeat delivery prefill (ownership enforced) ────────────────────────────

export interface RepeatDeliveryAddressPrefill {
  formattedAddress: string;
  placeId: string | null;
  line1: string;
  line2: string | null;
  suburb?: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  accessNotes: string | null;
}

export interface RepeatDeliveryPrefillDto {
  sourceOrderNumber: string;
  deliveryType: string;
  pickupAddress: RepeatDeliveryAddressPrefill | null;
  dropoffAddress: RepeatDeliveryAddressPrefill | null;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  parcelCount: number;
  parcelDescription: string;
  customerNote: string;
}

function toRepeatAddressPrefill(
  address: OrderDetailDto["pickupAddress"] | OrderDetailDto["dropoffAddress"],
): RepeatDeliveryAddressPrefill | null {
  if (!address) return null;
  return {
    formattedAddress:
      address.formattedAddress ??
      [
        address.line1,
        address.city,
        address.province,
        address.postalCode,
        address.country,
      ]
        .filter(Boolean)
        .join(", "),
    placeId: address.placeId,
    line1: address.line1,
    line2: address.line2,
    suburb: address.suburb ?? null,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    latitude: address.latitude,
    longitude: address.longitude,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    accessNotes: address.accessNotes,
  };
}

export async function getRepeatDeliveryPrefill(
  user: AuthenticatedUser,
  orderId: string,
  business = user.role === "STORE",
): Promise<RepeatDeliveryPrefillDto | null> {
  const order = await getOrder(user, orderId, business);
  if (!order) return null;

  return {
    sourceOrderNumber: order.orderNumber,
    deliveryType: order.deliveryType,
    pickupAddress: toRepeatAddressPrefill(order.pickupAddress),
    dropoffAddress: toRepeatAddressPrefill(order.dropoffAddress),
    recipientName:
      order.recipientName ?? order.dropoffAddress?.contactName ?? "",
    recipientPhone:
      order.recipientPhone ?? order.dropoffAddress?.contactPhone ?? "",
    recipientEmail: order.recipientEmail ?? "",
    parcelCount: order.parcelCount,
    parcelDescription: order.parcelDescription ?? "",
    customerNote: order.customerNote ?? "",
  };
}

// ─── Cancel (customer/store — only before pickup) ────────────────────────────

export type CancelOrderResult =
  | { order: OrderDetailDto; resolution?: CancellationResolutionSummaryDto | null }
  | {
      error: string;
      conflictCode?: "CANCELLATION_PENDING_PAYMENT_RESOLUTION";
      resolution?: CancellationResolutionSummaryDto | null;
    };

export async function cancelOrder(
  user: AuthenticatedUser,
  orderId: string,
  input: CustomerCancelOrderInput,
  business = user.role === "STORE",
  options?: { explicitStoreId?: string | null },
): Promise<CancelOrderResult> {
  const where = await buildOwnerWhere(user, business, options?.explicitStoreId);
  (where as Record<string, unknown>).id = orderId;

  const existing = await prisma.order.findFirst({
    where,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      source: true,
      storeId: true,
      customerId: true,
    },
  });

  if (!existing) return { error: "Order not found." };

  const context = {
    actorOwnsOrder: !business && user.role === "CUSTOMER",
    actorOwnsStore: business,
    cancellationWindowOpen: true,
  };

  if (
    existing.status !== OrderStatus.CANCELLED &&
    !canTransitionOrderStatus({
      from: existing.status,
      to: OrderStatus.CANCELLED,
      actorRole: user.role,
      context,
    })
  ) {
    return {
      error: `This order cannot be cancelled once it has progressed to ${existing.status}. Please contact KT Couriers for assistance.`,
    };
  }

  const reasonText =
    input.reason?.trim() ||
    `Cancelled by ${business ? "store" : "customer"}`;
  const actorRoleLabel = business ? "STORE" : user.role;
  const operationId = `cancel:${orderId}:${user.id}`;
  const requestHash = cancellationRequestHash({
    orderId,
    requestedByUserId: user.id,
    actorRole: actorRoleLabel,
    reason: reasonText,
  });

  const outcome = await withPaymentDatabaseRetry(() =>
    prisma.$transaction(
      async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`,
          );
        }

        const freshOrder =
          typeof tx.order?.findUnique === "function"
            ? await tx.order.findUnique({
                where: { id: orderId },
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  storeId: true,
                  customerId: true,
                },
              })
            : {
                id: existing.id,
                orderNumber: existing.orderNumber,
                status: existing.status,
                storeId: existing.storeId ?? null,
                customerId: existing.customerId ?? null,
              };

        if (!freshOrder) {
          return { kind: "ERROR" as const, error: "Order not found." };
        }

        if (freshOrder.status === OrderStatus.CANCELLED) {
          const existingResolution =
            typeof tx.parcelCancellationResolution?.findUnique === "function"
              ? await tx.parcelCancellationResolution.findUnique({
                  where: { orderId },
                })
              : null;
          if (existingResolution && existingResolution.status.startsWith("COMPLETED")) {
            const fullOrder = await tx.order.findUniqueOrThrow({
              where: { id: orderId },
              include: ORDER_FULL_INCLUDE,
            });
            return {
              kind: "COMPLETED" as const,
              order: fullOrder,
              resolution: toCancellationResolutionSummary(existingResolution),
            };
          }
          return {
            kind: "ERROR" as const,
            error: `This order cannot be cancelled once it has progressed to ${freshOrder.status}. Please contact KT Couriers for assistance.`,
          };
        }

        if (
          !canTransitionOrderStatus({
            from: freshOrder.status,
            to: OrderStatus.CANCELLED,
            actorRole: user.role,
            context,
          })
        ) {
          return {
            kind: "ERROR" as const,
            error: `This order cannot be cancelled once it has progressed to ${freshOrder.status}. Please contact KT Couriers for assistance.`,
          };
        }

        if (
          typeof tx.payment?.findUnique === "function" &&
          typeof tx.$queryRaw === "function"
        ) {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Payment" WHERE "orderId" = ${orderId} FOR UPDATE`,
          );
        }

        const payment =
          typeof tx.payment?.findUnique === "function"
            ? await tx.payment.findUnique({
                where: { orderId },
                select: {
                  id: true,
                  publicReference: true,
                  userId: true,
                  provider: true,
                  status: true,
                  amount: true,
                  totalRefundedAmount: true,
                  totalRefundReservedAmount: true,
                  version: true,
                  metadata: true,
                  attempts: {
                    orderBy: { attemptNumber: "asc" },
                    select: { id: true, status: true },
                  },
                },
              })
            : null;

        if (payment && typeof tx.$queryRaw === "function") {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "PaymentAttempt" WHERE "paymentId" = ${payment.id} ORDER BY "attemptNumber" ASC FOR UPDATE`,
          );
        }

        if (payment && hasUnresolvedProviderActivity(payment)) {
          const activeAttempt = payment.attempts.find((a) =>
            (UNRESOLVED_ATTEMPT_STATUSES as readonly string[]).includes(a.status),
          );
          const reconCase =
            typeof tx.paymentReconciliationCase?.findUnique === "function"
              ? await openPaymentReconciliationCaseWithinTransaction(tx, {
                  paymentId: payment.id,
                  attemptId: activeAttempt?.id ?? undefined,
                  reason: "UNKNOWN_OUTCOME",
                  provider: payment.provider === "PAYFAST" ? "PAYFAST" : "PAYSTACK",
                  safeEvidence: {
                    orderId,
                    paymentStatus: payment.status,
                    unresolvedAttemptIds: payment.attempts
                      .filter((a) =>
                        (UNRESOLVED_ATTEMPT_STATUSES as readonly string[]).includes(
                          a.status,
                        ),
                      )
                      .map((a) => a.id)
                      .join(","),
                    requestedByUserId: user.id,
                  },
                })
              : null;

          const pendingResolution = await upsertParcelCancellationResolutionInTx(
            tx,
            {
              orderId,
              paymentId: payment.id,
              status: "PENDING_PAYMENT_RESOLUTION",
              operationId,
              requestHash,
              requestedByUserId: user.id,
              actorRole: actorRoleLabel,
              reason: reasonText,
              reconciliationCaseId: reconCase?.id ?? null,
              decisionEvidence: {
                paymentStatus: payment.status,
                unresolvedAttemptIds: payment.attempts
                  .filter((a) =>
                    (UNRESOLVED_ATTEMPT_STATUSES as readonly string[]).includes(
                      a.status,
                    ),
                  )
                  .map((a) => a.id),
              },
              resolved: false,
            },
          );

          return {
            kind: "PENDING_PAYMENT" as const,
            error:
              "Payment is currently processing or awaiting confirmation. Order cancellation is pending payment resolution.",
            conflictCode: "CANCELLATION_PENDING_PAYMENT_RESOLUTION" as const,
            resolution: pendingResolution
              ? toCancellationResolutionSummary(pendingResolution)
              : null,
          };
        }

        await revokePendingDispatchOffersInTx(tx, {
          orderId,
          actorUserId: user.id,
          actorRole: actorRoleLabel,
          note: reasonText,
        });

        await cancelUncollectedCodObligationInTx(tx, {
          orderId,
          actorUserId: user.id,
          reason: reasonText,
        });

        await transitionOrderStatusInTx(tx, {
          orderId,
          fromStatus: freshOrder.status,
          toStatus: OrderStatus.CANCELLED,
          actorUserId: user.id,
          actorRole: user.role,
          reason: input.reason,
          note: input.reason?.trim()
            ? `Cancelled by ${business ? "store" : "customer"}: ${input.reason.trim()}`
            : `Cancelled by ${business ? "store" : "customer"}`,
          source: business ? "store_cancel_order" : "customer_cancel_order",
          context,
        });

        let resolution = null;
        if (payment && payment.status === "SUCCEEDED") {
          const settlement = await settlePaidOrderCancellationInTx(tx, {
            orderId,
            orderNumber: freshOrder.orderNumber,
            storeId: freshOrder.storeId,
            customerId: freshOrder.customerId,
            payment,
            reason: reasonText,
            preferredActorUserId: user.id,
            cancellationActorType: business ? "STORE" : "CUSTOMER",
            operationKeyPrefix: "order-cancel",
          });
          resolution = await upsertParcelCancellationResolutionInTx(tx, {
            orderId,
            paymentId: payment.id,
            status: "COMPLETED_REFUND_INITIATED",
            operationId,
            requestHash,
            requestedByUserId: user.id,
            actorRole: actorRoleLabel,
            reason: reasonText,
            walletOwnerType: settlement.walletOwnerType,
            walletOwnerId: settlement.walletOwnerId,
            walletRefundJournalId: settlement.walletRefundJournalId,
            paymentRefundId: settlement.paymentRefundId,
            decisionEvidence: {
              paymentStatus: payment.status,
              provider: payment.provider,
              paymentRefundId: settlement.paymentRefundId,
              walletRefundJournalId: settlement.walletRefundJournalId,
            },
            resolved: true,
          });
        } else {
          const split = payment
            ? extractParcelWalletSplit(payment, freshOrder)
            : { walletSplit: false, walletAmount: null, owner: null };
          if (
            payment &&
            split.walletSplit &&
            ["CREATED", "FAILED", "CANCELLED", "EXPIRED"].includes(payment.status)
          ) {
            await releaseParcelOrderWalletReservationWithinTransaction(tx, {
              orderId,
              reason:
                input.reason?.trim() || "Parcel order cancelled before provider settlement",
              actorUserId: user.id,
            });
          }

          if (
            payment &&
            payment.status === "CREATED" &&
            typeof tx.payment?.update === "function"
          ) {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
                version: { increment: 1 },
              },
            });
            if (typeof tx.paymentStatusHistory?.create === "function") {
              await tx.paymentStatusHistory.create({
                data: {
                  paymentId: payment.id,
                  fromStatus: "CREATED",
                  toStatus: "CANCELLED",
                  reasonCode: "ORDER_CANCELLED",
                  actorType: "PAYER",
                  actorId: user.id,
                  metadata: { orderId, reason: reasonText },
                },
              });
            }
          }

          resolution = await upsertParcelCancellationResolutionInTx(tx, {
            orderId,
            paymentId: payment?.id ?? null,
            status: "COMPLETED_NO_PAYMENT",
            operationId,
            requestHash,
            requestedByUserId: user.id,
            actorRole: actorRoleLabel,
            reason: reasonText,
            walletOwnerType: split.owner?.ownerType ?? null,
            walletOwnerId: split.owner?.ownerId ?? null,
            decisionEvidence: {
              paymentStatus: payment?.status ?? null,
              walletHoldReleased: split.walletSplit,
            },
            resolved: true,
          });
        }

        const fullOrder = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: ORDER_FULL_INCLUDE,
        });

        return {
          kind: "COMPLETED" as const,
          order: fullOrder,
          resolution: resolution ? toCancellationResolutionSummary(resolution) : null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      },
    ),
  );

  if (outcome.kind === "PENDING_PAYMENT") {
    return {
      error: outcome.error,
      conflictCode: outcome.conflictCode,
      resolution: outcome.resolution,
    };
  }
  if (outcome.kind === "ERROR") {
    return { error: outcome.error };
  }

  return {
    order: toOrderDetailDto(outcome.order),
    ...(outcome.resolution ? { resolution: outcome.resolution } : {}),
  };
}

// ─── Order counts (for dashboard) ────────────────────────────────────────────

export async function getOrderCounts(
  user: AuthenticatedUser,
): Promise<UserOrderCountsDto> {
  const base = await buildOwnerWhere(user);

  const [total, pending, confirmed, inProgress, completed, cancelled] =
    await Promise.all([
      prisma.order.count({ where: base }),
      prisma.order.count({ where: { ...base, status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { ...base, status: OrderStatus.CONFIRMED } }),
      prisma.order.count({
        where: {
          ...base,
          status: {
            in: [
              OrderStatus.IN_PROGRESS,
              OrderStatus.PICKUP_SCHEDULED,
              OrderStatus.PICKED_UP,
              OrderStatus.IN_TRANSIT,
              OrderStatus.DELIVERY_ATTEMPTED,
            ],
          },
        },
      }),
      prisma.order.count({
        where: {
          ...base,
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
      }),
      prisma.order.count({ where: { ...base, status: OrderStatus.CANCELLED } }),
    ]);

  return { total, pending, confirmed, inProgress, completed, cancelled };
}

// ─── Private: build ownership where clause ───────────────────────────────────

async function buildOwnerWhere(
  user: AuthenticatedUser,
  business = user.role === "STORE",
  explicitStoreId?: string | null,
): Promise<Record<string, unknown>> {
  if (business)
    return {
      storeId: (
        await (explicitStoreId
          ? storeAccess(user.id, "orders", explicitStoreId)
          : storeAccess(user.id, "orders"))
      ).store.id,
    };
  if (user.role === "CUSTOMER") return { customerId: user.id };
  throw new Error("Order access is unavailable for this account.");
}
