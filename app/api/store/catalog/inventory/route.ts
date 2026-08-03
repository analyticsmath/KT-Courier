import { type NextRequest } from "next/server";
import { storeInventoryGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return storeInventoryGet(request); }

