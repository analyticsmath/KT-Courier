import { type NextRequest } from "next/server";
import { storeCatalogMediaGet } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeCatalogMediaGet(request, (await params).publicReference); }
