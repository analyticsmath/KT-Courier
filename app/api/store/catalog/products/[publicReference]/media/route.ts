import { type NextRequest } from "next/server";
import { storeCatalogMediaAttach } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeCatalogMediaAttach(request, (await params).publicReference); }
