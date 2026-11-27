import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { forbidden, notFound, serverError, tooManyRequests, unauthorized } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { MARKETPLACE_ORDER_COOKIE, verifyMarketplaceGuestSecret } from "@/lib/marketplace-checkout/tokens";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { ShipmentDocumentError } from "@/lib/shipment-documents/contracts";
import { issueShipmentDocumentInTx } from "@/lib/shipment-documents/service";
import { renderShipmentDocumentPdf } from "@/lib/shipment-documents/render-pdf";
import { sanitizePayloadForViewerRole } from "@/lib/shipment-documents/projection";
import type { ShipmentPodPayload } from "@/lib/shipment-documents/contracts";
import { withPaymentDatabaseRetry } from "@/lib/payments/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string; storeOrderReference: string }> },
) {
  const { reference, storeOrderReference } = await params;

  const limit = await checkIpRateLimit(
    request,
    `marketplace-pod:${reference}`,
    RATE_LIMITS.SHIPMENT_DOCUMENT_DOWNLOAD,
  );
  if (!limit.ok) {
    return limit.failClosed
      ? NextResponse.json(limit.errorResponse, { status: 503 })
      : tooManyRequests(limit.retryAfterSeconds);
  }

  const user = await getCurrentUser();
  const guestSecret = request.cookies.get(MARKETPLACE_ORDER_COOKIE)?.value ?? undefined;
  if (!user && !guestSecret) {
    return unauthorized("Customer order ownership is required.");
  }

  try {
    const database = prisma as unknown as {
      marketplaceOrder: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          customerUserId: string | null;
          guestConfirmationHash: string | null;
          storeOrders: Array<{
            id: string;
            publicReference: string;
            deliveryBridge: { courierOrderId: string | null } | null;
          }>;
        } | null>;
      };
    };

    const mpOrder = await database.marketplaceOrder.findUnique({
      where: { publicReference: reference },
      select: {
        id: true,
        customerUserId: true,
        guestConfirmationHash: true,
        storeOrders: {
          where: { publicReference: storeOrderReference },
          take: 1,
          select: {
            id: true,
            publicReference: true,
            deliveryBridge: { select: { courierOrderId: true } },
          },
        },
      },
    });

    if (!mpOrder || mpOrder.storeOrders.length === 0) {
      return notFound("Store order confirmation was not found.");
    }

    const activeCustomerMatch =
      Boolean(mpOrder.customerUserId) &&
      user?.status === "ACTIVE" &&
      user?.id === mpOrder.customerUserId;
    const guestSecretMatch =
      !mpOrder.customerUserId &&
      verifyMarketplaceGuestSecret(guestSecret, mpOrder.guestConfirmationHash);
    const authorizedOwner = activeCustomerMatch || guestSecretMatch;

    if (!authorizedOwner) {
      return forbidden("You do not have permission to download proof of delivery for this order.");
    }

    const courierOrderId = mpOrder.storeOrders[0]?.deliveryBridge?.courierOrderId;
    if (!courierOrderId) {
      return NextResponse.json(
        { error: "Courier delivery record is not bridged for this store order yet.", code: "POD_PROOF_MISSING" },
        { status: 409 },
      );
    }

    let docRow = await prisma.shipmentDocument.findFirst({
      where: { orderId: courierOrderId, type: "POD", status: "ISSUED" },
      orderBy: [{ revision: "desc" }],
      include: { order: { select: { orderNumber: true, isQaAcceptance: true } } },
    });

    if (!docRow) {
      const issued = await withPaymentDatabaseRetry(() =>
        prisma.$transaction((tx) =>
          issueShipmentDocumentInTx(tx, {
            orderId: courierOrderId,
            type: "POD",
            actorUserId: user?.id ?? null,
            actorRole: user ? "CUSTOMER" : "GUEST_CHECKOUT",
            sourceEventRef: `marketplace-pod:${reference}:${storeOrderReference}`,
          }),
        ),
      );
      docRow = await prisma.shipmentDocument.findUnique({
        where: { id: issued.documentId },
        include: { order: { select: { orderNumber: true, isQaAcceptance: true } } },
      });
    }

    if (!docRow || !docRow.proofOfDeliveryId) {
      return NextResponse.json(
        { error: "Official Proof of Delivery is available only once delivery proof is recorded.", code: "POD_PROOF_MISSING" },
        { status: 409 },
      );
    }

    const storedPayload = docRow.payloadSnapshot as unknown as ShipmentPodPayload;
    const authoritativePayload = (docRow.order as { isQaAcceptance?: boolean } | null)?.isQaAcceptance
      ? { ...storedPayload, isQaAcceptance: true }
      : storedPayload;
    const payload = sanitizePayloadForViewerRole(
      authoritativePayload,
      "CUSTOMER",
    );
    const bytes = await renderShipmentDocumentPdf(payload);
    const safeRef = (docRow.order?.orderNumber ?? storeOrderReference).replace(/[^A-Za-z0-9-]/g, "");
    const disposition = request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="KT-Couriers-POD-${safeRef}-R${docRow.revision}.pdf"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-KT-Document-Ref": docRow.documentRef,
      },
    });
  } catch (error) {
    if (error instanceof ShipmentDocumentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.actionHref ? { actionHref: error.actionHref } : {}),
        },
        { status: error.statusCode },
      );
    }
    return serverError();
  }
}
