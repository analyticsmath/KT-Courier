import { type NextRequest } from "next/server";
import { storeCatalogMediaArchive } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeCatalogMediaArchive(request, (await params).publicReference); }
