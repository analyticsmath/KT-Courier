import { type NextRequest } from "next/server";
import { adminProductsGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) { return adminProductsGet(request); }

