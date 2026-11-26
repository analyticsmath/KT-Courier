import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { PlatformError } from "@/lib/client-platform/contracts";
import { storeAccess } from "@/lib/client-platform/store-access";
import { UserRole } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import {
  ShipmentDocumentError,
  type ShipmentDocumentViewerRole,
} from "./contracts";

export type ShipmentDocumentAccessAction =
  | "WAYBILL"
  | "POD"
  | "RECOVER"
  | "TRACKING_GRANT";

export interface AuthorizedShipmentOrderContext {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderSource: string;
  customerId: string | null;
  storeId: string | null;
  viewerRole: ShipmentDocumentViewerRole;
  actorUserId: string;
  driverProfileId: string | null;
}

export async function authorizeShipmentDocumentAccess(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  action: ShipmentDocumentAccessAction;
  explicitStoreId?: string | null;
}): Promise<AuthorizedShipmentOrderContext> {
  const { user, orderId, action, explicitStoreId } = args;
  if (!user) {
    throw new ShipmentDocumentError(
      "UNAUTHORIZED",
      401,
      "Authentication is required to access shipment documents.",
    );
  }

  const normalizedId = orderId.trim();
  if (!normalizedId || normalizedId.length > 100) {
    throw new ShipmentDocumentError(
      "ORDER_NOT_FOUND",
      404,
      "Shipment order was not found.",
    );
  }

  // Always check caller authority cleanly before loading or revealing order state.
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    const requiredPermission =
      action === "RECOVER"
        ? PERMISSIONS.ORDERS_STATUS_MANAGE
        : PERMISSIONS.ORDERS_READ;
    const allowed =
      user.role === UserRole.SUPER_ADMIN ||
      (await hasPermission({
        userId: user.id,
        role: user.role,
        permissionKey: requiredPermission,
      }));
    if (!allowed) {
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "You do not have permission to perform this order document action.",
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        source: true,
        customerId: true,
        storeId: true,
      },
    });
    if (!order) {
      throw new ShipmentDocumentError(
        "ORDER_NOT_FOUND",
        404,
        "Shipment order was not found.",
      );
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      orderSource: order.source,
      customerId: order.customerId,
      storeId: order.storeId,
      viewerRole: "ADMIN",
      actorUserId: user.id,
      driverProfileId: null,
    };
  }

  if (user.role === UserRole.DRIVER) {
    if (action !== "WAYBILL" && action !== "POD") {
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "Drivers may only view or download documents for assigned deliveries.",
      );
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true },
    });
    if (!driver || driver.status !== "ACTIVE") {
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "An active driver profile is required.",
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        source: true,
        customerId: true,
        storeId: true,
        currentDriverProfileId: true,
        assignments: {
          where: {
            driverProfileId: driver.id,
            OR: [
              { status: "COMPLETED" },
              {
                status: "ACCEPTED",
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!order) {
      throw new ShipmentDocumentError(
        "ORDER_NOT_FOUND",
        404,
        "Shipment order was not found.",
      );
    }

    const hasAcceptedAssignment = order.assignments.length > 0;
    const isCurrentOrCompletedDriver =
      order.currentDriverProfileId === driver.id || hasAcceptedAssignment;
    if (!isCurrentOrCompletedDriver) {
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "You can only download shipment documents for your own accepted assignments.",
      );
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      orderSource: order.source,
      customerId: order.customerId,
      storeId: order.storeId,
      viewerRole: "DRIVER",
      actorUserId: user.id,
      driverProfileId: driver.id,
    };
  }

  if (user.role === UserRole.CUSTOMER || user.role === UserRole.STORE) {
    // A STORE account owner, employee member, or customer owns parcels under
    // either storeId (via active storeAccess) or personal customerId.
    let authorizedStoreId: string | null = null;
    let storeContextChecked = false;
    if (user.role === UserRole.STORE || explicitStoreId) {
      try {
        const access = await storeAccess(
          user.id,
          "deliveries",
          explicitStoreId ?? undefined,
        );
        authorizedStoreId = access.store.id;
        storeContextChecked = true;
      } catch (err) {
        if (err instanceof PlatformError && user.role === UserRole.STORE && explicitStoreId) {
          throw new ShipmentDocumentError("FORBIDDEN", err.status, err.message);
        }
        // Customer without a business membership can still own personal orders.
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        source: true,
        customerId: true,
        storeId: true,
      },
    });
    if (!order) {
      throw new ShipmentDocumentError(
        "ORDER_NOT_FOUND",
        404,
        "Shipment order was not found.",
      );
    }

    const ownsViaStore =
      Boolean(authorizedStoreId) && order.storeId === authorizedStoreId;
    const ownsAsCustomer =
      !explicitStoreId &&
      order.customerId === user.id &&
      (order.storeId === null || user.role === UserRole.CUSTOMER);

    if (!ownsViaStore && !ownsAsCustomer) {
      if (storeContextChecked && order.storeId && order.storeId !== authorizedStoreId) {
        throw new ShipmentDocumentError(
          "FORBIDDEN",
          403,
          "You do not have permission to access this store shipment.",
        );
      }
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "You do not have permission to access this shipment.",
      );
    }

    if (
      action === "RECOVER" &&
      user.role !== UserRole.CUSTOMER &&
      !ownsViaStore
    ) {
      throw new ShipmentDocumentError(
        "FORBIDDEN",
        403,
        "You do not have permission to regenerate this shipment document.",
      );
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      orderSource: order.source,
      customerId: order.customerId,
      storeId: order.storeId,
      viewerRole: ownsViaStore ? "STORE" : "CUSTOMER",
      actorUserId: user.id,
      driverProfileId: null,
    };
  }

  throw new ShipmentDocumentError(
    "FORBIDDEN",
    403,
    "Your account role is not authorized to access parcel shipment documents.",
  );
}
