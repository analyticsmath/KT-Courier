import { type NextRequest } from "next/server";
import { adminCatalogMediaReview } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminCatalogMediaReview(request, (await params).id, "APPROVE"); }
