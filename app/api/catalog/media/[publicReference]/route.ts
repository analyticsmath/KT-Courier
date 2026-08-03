import { type NextRequest } from "next/server";
import { catalogApiError } from "@/lib/catalog/catalog-api-policy";
import { createProductionCatalogMediaDeliveryService } from "@/lib/services/catalog-media-delivery.service";

const service = createProductionCatalogMediaDeliveryService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  try {
    const result = await service.deliver((await params).publicReference);
    return new Response(result.body as any, { status: 200, headers: result.headers as any });
  } catch (error) {
    return catalogApiError(error);
  }
}
