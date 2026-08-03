import { type NextRequest } from "next/server";
import { adminCatalogMediaList } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(request: NextRequest) { return adminCatalogMediaList(request); }
