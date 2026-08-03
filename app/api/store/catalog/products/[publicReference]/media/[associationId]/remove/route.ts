import { type NextRequest } from "next/server";
import { storeCatalogMediaAssociationRemove } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string; associationId: string }> }) { const value = await params; return storeCatalogMediaAssociationRemove(request, value.publicReference, value.associationId); }
