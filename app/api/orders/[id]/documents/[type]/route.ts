import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { notFound, tooManyRequests, unauthorized, serverError } from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { ShipmentDocumentError, type ShipmentDocumentKind } from "@/lib/shipment-documents/contracts";
import { downloadAuthorizedShipmentDocumentPdf } from "@/lib/shipment-documents/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDocumentKind(rawType: string): ShipmentDocumentKind | null {
  const upper = rawType.trim().toUpperCase();
  if (upper === "WAYBILL") return "WAYBILL";
  if (upper === "POD") return "POD";
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id, type: rawType } = await params;
  const docType = parseDocumentKind(rawType);
  if (!docType) return notFound("Unsupported shipment document type.");

  const limit = await checkIpRateLimit(
    request,
    `shipment-doc-download:${user.id}`,
    RATE_LIMITS.SHIPMENT_DOCUMENT_DOWNLOAD,
  );
  if (!limit.ok) {
    return limit.failClosed
      ? NextResponse.json(limit.errorResponse, { status: 503 })
      : tooManyRequests(limit.retryAfterSeconds);
  }

  const dispositionMode =
    request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const explicitStoreId = request.nextUrl.searchParams.get("storeId");

  try {
    const pdf = await downloadAuthorizedShipmentDocumentPdf({
      user,
      orderId: id,
      type: docType,
      explicitStoreId,
    });

    const safeFileName = pdf.fileName.replace(/["\\r\n]/g, "");
    return new NextResponse(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionMode}; filename="${safeFileName}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-KT-Document-Ref": pdf.documentRef,
        "X-KT-Document-Revision": String(pdf.revision),
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
        {
          status: error.statusCode,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        },
      );
    }
    return serverError();
  }
}
