import { type NextRequest } from "next/server";
import { storeCatalogMediaUploadCreate } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest) { return storeCatalogMediaUploadCreate(request); }
