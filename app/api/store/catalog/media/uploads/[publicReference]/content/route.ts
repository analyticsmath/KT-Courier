import { type NextRequest } from "next/server";
import { storeCatalogMediaUploadContent } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeCatalogMediaUploadContent(request, (await params).publicReference); }
