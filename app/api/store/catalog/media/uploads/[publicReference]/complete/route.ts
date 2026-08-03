import { type NextRequest } from "next/server";
import { storeCatalogMediaUploadComplete } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeCatalogMediaUploadComplete(request, (await params).publicReference); }
