import { type NextRequest } from "next/server";
import { adminCatalogMediaGet } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminCatalogMediaGet(request, (await params).id); }
