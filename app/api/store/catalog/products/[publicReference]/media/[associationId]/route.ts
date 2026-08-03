import { type NextRequest } from "next/server";
import { storeCatalogMediaAssociationUpdate } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ publicReference: string; associationId: string }> }) { const value = await params; return storeCatalogMediaAssociationUpdate(request, value.publicReference, value.associationId); }
