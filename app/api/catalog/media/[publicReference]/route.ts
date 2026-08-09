import { type NextRequest } from "next/server";
import { catalogApiError } from "@/lib/catalog/catalog-api-policy";
import { createProductionCatalogMediaDeliveryService } from "@/lib/services/catalog-media-delivery.service";

const service = createProductionCatalogMediaDeliveryService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  try {
    const result = await service.deliver((await params).publicReference);
    return new Response(Uint8Array.from(result.body), { status: 200, headers: result.headers });
  } catch (error) {
    return catalogApiError(error);
  }
}
