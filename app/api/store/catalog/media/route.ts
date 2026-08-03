import { type NextRequest } from "next/server";
import { storeCatalogMediaList } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(request: NextRequest) { return storeCatalogMediaList(request); }
