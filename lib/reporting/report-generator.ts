import { db } from "@/lib/db";
import { REPORT_DEFINITIONS, ReportingError } from "./contracts";

export interface ReportQueryContext {
  definitionKey: string;
  requesterUserId: string;
  requesterRole: string;
  ownerScope: {
    userId?: string;
    storeId?: string;
    driverProfileId?: string;
    promoterId?: string;
    applicationId?: string;
  };
  filters: Record<string, unknown>;
  limit: number;
}

export async function generateReportData(
  context: ReportQueryContext
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const definition = REPORT_DEFINITIONS[context.definitionKey];
  if (!definition) {
    throw new ReportingError("REPORT_DEFINITION_NOT_FOUND", 404, `Unknown report key: ${context.definitionKey}`);
  }

  const limit = Math.min(context.limit, definition.maximumRowCount);

  switch (context.definitionKey) {
    case "customer-courier-orders": {
      const userId = context.ownerScope.userId || context.requesterUserId;
      const where: any = { customerId: userId };
      if (context.filters.status && typeof context.filters.status === "string") {
        where.status = context.filters.status;
      }
      const orders = await db.order.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          deliveryType: true,
          status: true,
          priceEstimate: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const headers = ["Order Reference", "Type", "Status", "Total Amount (ZAR)", "Currency", "Created At", "Updated At"];
      const rows = orders.map((o) => ({
        "Order Reference": o.orderNumber,
        Type: o.deliveryType,
        Status: o.status,
        "Total Amount (ZAR)": Number(o.priceEstimate ?? 0).toFixed(2),
        Currency: o.currency,
        "Created At": o.createdAt.toISOString(),
        "Updated At": o.updatedAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "customer-payments": {
      const userId = context.ownerScope.userId || context.requesterUserId;
      const payments = await db.payment.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          provider: true,
          purpose: true,
          status: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      });
      const headers = ["Payment Reference", "Provider", "Purpose", "Status", "Amount", "Currency", "Created At"];
      const rows = payments.map((p: any) => ({
        "Payment Reference": p.publicReference,
        Provider: p.provider || "N/A",
        Purpose: p.purpose,
        Status: p.status,
        Amount: Number(p.amount).toFixed(2),
        Currency: p.currency,
        "Created At": p.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "customer-marketplace-orders": {
      const userId = context.ownerScope.userId || context.requesterUserId;
      const parentOrders = await db.marketplaceOrder.findMany({
        where: { customerUserId: userId },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          status: true,
          grandTotal: true,
          currency: true,
          createdAt: true,
        },
      });
      const headers = ["Marketplace Order Reference", "Status", "Grand Total", "Currency", "Created At"];
      const rows = parentOrders.map((p: any) => ({
        "Marketplace Order Reference": p.publicReference,
        Status: p.status,
        "Grand Total": Number(p.grandTotal).toFixed(2),
        Currency: p.currency,
        "Created At": p.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "customer-personal-data": {
      const userId = context.ownerScope.userId || context.requesterUserId;
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Field", "Value"];
      const rows = user
        ? Object.entries(user).map(([k, v]) => ({
            Field: k,
            Value: v instanceof Date ? v.toISOString() : String(v ?? ""),
          }))
        : [];
      return { headers, rows };
    }

    case "store-orders": {
      const storeId = context.ownerScope.storeId;
      if (!storeId) throw new ReportingError("STORE_ID_REQUIRED", 400, "Store context is required.");
      const where: any = { storeId };
      if (context.filters.status && typeof context.filters.status === "string") {
        where.status = context.filters.status;
      }
      const storeOrders = await db.marketplaceStoreOrder.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          status: true,
          groupTotal: true,
          currency: true,
          createdAt: true,
        },
      });
      const headers = ["Store Order Reference", "Status", "Group Total", "Currency", "Created At"];
      const rows = storeOrders.map((s) => ({
        "Store Order Reference": s.publicReference,
        Status: s.status,
        "Group Total": Number(s.groupTotal).toFixed(2),
        Currency: s.currency,
        "Created At": s.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "store-earnings": {
      const storeId = context.ownerScope.storeId;
      if (!storeId) throw new ReportingError("STORE_ID_REQUIRED", 400, "Store context is required.");
      const earnings = await db.storeEarning.findMany({
        where: { storeId },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          settlementBasisAmount: true,
          attributedCommissionAmount: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Earning Reference", "Gross Amount", "Commission", "Net Earning", "Status", "Created At"];
      const rows = earnings.map((e) => ({
        "Earning Reference": e.publicReference,
        "Gross Amount": Number(e.settlementBasisAmount).toFixed(2),
        Commission: Number(e.attributedCommissionAmount).toFixed(2),
        "Net Earning": Number(e.amount).toFixed(2),
        Status: e.status,
        "Created At": e.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "store-products-catalog": {
      const storeId = context.ownerScope.storeId;
      if (!storeId) throw new ReportingError("STORE_ID_REQUIRED", 400, "Store context is required.");
      const products = await db.catalogProduct.findMany({
        where: { sourceStoreId: storeId },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Product Reference", "Title", "Slug", "Status", "Created At"];
      const rows = products.map((p) => ({
        "Product Reference": p.publicReference,
        Title: p.title,
        Slug: p.slug,
        Status: p.status,
        "Created At": p.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "driver-completed-deliveries": {
      const driverProfileId = context.ownerScope.driverProfileId;
      const assignments = await db.orderAssignment.findMany({
        where: {
          driverProfileId: driverProfileId || undefined,
          status: "COMPLETED",
        },
        take: limit,
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          status: true,
          assignedAt: true,
          acceptedAt: true,
          completedAt: true,
          order: { select: { orderNumber: true } },
        },
      });
      const headers = ["Assignment ID", "Order Reference", "Status", "Assigned At", "Completed At"];
      const rows = assignments.map((a) => ({
        "Assignment ID": a.id,
        "Order Reference": a.order?.orderNumber || "N/A",
        Status: a.status,
        "Assigned At": a.assignedAt.toISOString(),
        "Completed At": a.completedAt ? a.completedAt.toISOString() : "",
      }));
      return { headers, rows };
    }

    case "driver-earnings": {
      const driverProfileId = context.ownerScope.driverProfileId;
      const earnings = await db.driverEarning.findMany({
        where: { driverId: driverProfileId || undefined },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          settlementBasisAmount: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Earning Reference", "Gross Amount", "Net Earning", "Status", "Created At"];
      const rows = earnings.map((e) => ({
        "Earning Reference": e.publicReference,
        "Gross Amount": Number(e.settlementBasisAmount).toFixed(2),
        "Net Earning": Number(e.amount).toFixed(2),
        Status: e.status,
        "Created At": e.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "promoter-referrals": {
      const promoterId = context.ownerScope.promoterId;
      const attributions = await db.promoterAttribution.findMany({
        where: { promoterAccountId: promoterId || undefined },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          subjectKey: true,
          subjectType: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Attribution Reference", "Subject Key", "Type", "Status", "Created At"];
      const rows = attributions.map((a) => ({
        "Attribution Reference": a.publicReference,
        "Subject Key": a.subjectKey,
        Type: a.subjectType,
        Status: a.status,
        "Created At": a.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "promoter-earnings": {
      const promoterId = context.ownerScope.promoterId;
      const earnings = await db.promoterEarning.findMany({
        where: { promoterAccountId: promoterId || undefined },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          grossAmount: true,
          payableAmount: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Earning Reference", "Gross Amount", "Payable Amount", "Status", "Created At"];
      const rows = earnings.map((e) => ({
        "Earning Reference": e.publicReference,
        "Gross Amount": Number(e.grossAmount).toFixed(2),
        "Payable Amount": Number(e.payableAmount).toFixed(2),
        Status: e.status,
        "Created At": e.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "developer-api-usage": {
      const apiLogs = await db.apiRequestLog.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          method: true,
          path: true,
          statusCode: true,
          createdAt: true,
        },
      });
      const headers = ["Log ID", "Method", "Path", "Status Code", "Created At"];
      const rows = apiLogs.map((u) => ({
        "Log ID": u.id,
        Method: u.method,
        Path: u.path,
        "Status Code": u.statusCode ?? 200,
        "Created At": u.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "admin-order-volume": {
      const orders = await db.order.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          deliveryType: true,
          status: true,
          priceEstimate: true,
          createdAt: true,
        },
      });
      const headers = ["Order Reference", "Type", "Status", "Total Amount", "Created At"];
      const rows = orders.map((o) => ({
        "Order Reference": o.orderNumber,
        Type: o.deliveryType,
        Status: o.status,
        "Total Amount": Number(o.priceEstimate ?? 0).toFixed(2),
        "Created At": o.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "admin-payfast-reconciliation": {
      const cases = await db.paymentReconciliationCase.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          reason: true,
          status: true,
          priority: true,
          openedAt: true,
        },
      });
      const headers = ["Case Reference", "Reason", "Status", "Priority", "Opened At"];
      const rows = cases.map((c) => ({
        "Case Reference": c.publicReference,
        Reason: c.reason,
        Status: c.status,
        Priority: c.priority,
        "Opened At": c.openedAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "admin-financial-reconciliation": {
      const entries = await db.ledgerEntry.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          lineCode: true,
          direction: true,
          amount: true,
          createdAt: true,
        },
      });
      const headers = ["Entry ID", "Line Code", "Direction", "Amount", "Created At"];
      const rows = entries.map((e) => ({
        "Entry ID": e.id,
        "Line Code": e.lineCode,
        Direction: e.direction,
        Amount: Number(e.amount).toFixed(2),
        "Created At": e.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    case "admin-recruitment-pipeline": {
      const applications = await db.recruitmentApplication.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          publicReference: true,
          openingId: true,
          status: true,
          createdAt: true,
        },
      });
      const headers = ["Application Reference", "Opening ID", "Status", "Created At"];
      const rows = applications.map((a: any) => ({
        "Application Reference": a.publicReference,
        "Opening ID": a.openingId,
        Status: a.status,
        "Created At": a.createdAt.toISOString(),
      }));
      return { headers, rows };
    }

    default:
      throw new ReportingError("REPORT_NOT_IMPLEMENTED", 501, `Report key not implemented: ${context.definitionKey}`);
  }
}
